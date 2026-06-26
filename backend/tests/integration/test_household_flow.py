"""End-to-end household management (feature plan §Backend acceptance):

create → switch → invite → accept → members → roles → archive, plus the security
invariants: the switch-survives-refresh regression, ``{id}``-must-equal-active-claim,
the email-binding check on acceptance, last-owner protection, and permission enforcement.
"""

from __future__ import annotations

import re

import jwt
import pytest

pytestmark = pytest.mark.integration

PASSWORD = "correct horse battery staple"
JWT_SECRET = "x" * 40  # matches the conftest app fixture
BEARER = {"X-Auth-Transport": "bearer"}  # body-token transport keeps the helpers simple


def _last_token(mailbox, email: str, kind: str) -> str:
    """Most recent ``/<kind>/<token>`` link emailed to ``email`` (a recipient may have both
    an invitation and an activation message)."""
    pattern = re.compile(rf"/{kind}/([A-Za-z0-9_-]+)")
    for msg in reversed(mailbox.sent):
        if msg.to != email:
            continue
        match = pattern.search(msg.text_body)
        if match:
            return match.group(1)
    raise AssertionError(f"no /{kind}/ link emailed to {email}")


def _signup(client, mailbox, email: str, name: str = "User") -> None:
    r = client.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD, "display_name": name},
    )
    assert r.status_code == 202
    token = _last_token(mailbox, email, "activate")
    assert client.post("/api/auth/activate", json={"token": token}).status_code == 200


def _login(client, email: str) -> dict:
    r = client.post(
        "/api/auth/login", json={"email": email, "password": PASSWORD}, headers=BEARER
    )
    assert r.status_code == 200
    return r.json


def _auth(access: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access}"}


def _claims(access: str) -> dict:
    return jwt.decode(access, JWT_SECRET, algorithms=["HS256"])


def _create_household(client, access: str, name: str = "Home") -> dict:
    r = client.post("/api/households", json={"name": name}, headers=_auth(access))
    assert r.status_code == 201, r.json
    return r.json  # {access_token, token_type, household}


def _invite_token(mailbox, email: str) -> str:
    return _last_token(mailbox, email, "invite")


def test_create_household_makes_owner_and_autoswitches(client, mailbox) -> None:
    _signup(client, mailbox, "a@example.com")
    session = _login(client, "a@example.com")

    created = _create_household(client, session["access_token"], "Casa")
    assert created["household"]["role"] == "OWNER"
    assert created["household"]["name"] == "Casa"
    # The returned token is auto-switched into the new household.
    assert _claims(created["access_token"])["household_id"] == created["household"]["id"]

    listing = client.get("/api/households", headers=_auth(created["access_token"]))
    assert listing.status_code == 200
    assert [h["name"] for h in listing.json["households"]] == ["Casa"]


def test_switch_survives_refresh(client, mailbox) -> None:
    """Regression: a refresh must re-mint into the *switched* household, never snap back to
    the first membership (the old ``_active_membership`` bug)."""
    _signup(client, mailbox, "multi@example.com")
    session = _login(client, "multi@example.com")
    refresh = session["refresh_token"]

    first = _create_household(client, session["access_token"], "First")
    second = _create_household(client, first["access_token"], "Second")
    h1, h2 = first["household"]["id"], second["household"]["id"]

    # Active is h2 (created last). A refresh keeps h2 even though h1 is membership[0].
    refreshed = client.post(
        "/api/auth/refresh", json={"refresh_token": refresh}, headers=BEARER
    )
    assert refreshed.status_code == 200
    assert _claims(refreshed.json["access_token"])["household_id"] == h2
    refresh = refreshed.json["refresh_token"]

    # Switch to h1, then refresh → still h1.
    switched = client.post(f"/api/households/{h1}/switch", headers=_auth(second["access_token"]))
    assert switched.status_code == 200
    assert switched.json["household"]["id"] == h1
    refreshed2 = client.post(
        "/api/auth/refresh", json={"refresh_token": refresh}, headers=BEARER
    )
    assert _claims(refreshed2.json["access_token"])["household_id"] == h1


def test_switch_to_non_member_household_is_404(client, mailbox) -> None:
    _signup(client, mailbox, "owner@example.com")
    _signup(client, mailbox, "outsider@example.com")
    owner = _create_household(client, _login(client, "owner@example.com")["access_token"])
    outsider = _login(client, "outsider@example.com")

    r = client.post(
        f"/api/households/{owner['household']['id']}/switch",
        headers=_auth(outsider["access_token"]),
    )
    assert r.status_code == 404  # no membership → indistinguishable from "not found"


def test_tenant_route_requires_active_household(client, mailbox) -> None:
    _signup(client, mailbox, "two@example.com")
    session = _login(client, "two@example.com")
    first = _create_household(client, session["access_token"], "First")
    second = _create_household(client, first["access_token"], "Second")

    # Active household is Second; renaming First (not the active one) is refused.
    r = client.patch(
        f"/api/households/{first['household']['id']}",
        json={"name": "Renamed"},
        headers=_auth(second["access_token"]),
    )
    assert r.status_code == 409


def test_invite_accept_and_member_list(client, mailbox) -> None:
    _signup(client, mailbox, "host@example.com")
    host = _create_household(client, _login(client, "host@example.com")["access_token"], "Flat")
    hid = host["household"]["id"]

    invite = client.post(
        f"/api/households/{hid}/invitations",
        json={"email": "guest@example.com", "role": "MEMBER"},
        headers=_auth(host["access_token"]),
    )
    assert invite.status_code == 201
    token = _invite_token(mailbox, "guest@example.com")

    preview = client.get(f"/api/invitations/{token}")
    assert preview.status_code == 200
    assert preview.json["household_name"] == "Flat"
    assert preview.json["role"] == "MEMBER"

    _signup(client, mailbox, "guest@example.com")
    guest = _login(client, "guest@example.com")
    accept = client.post(
        "/api/invitations/accept", json={"token": token}, headers=_auth(guest["access_token"])
    )
    assert accept.status_code == 200
    assert accept.json["household"]["role"] == "MEMBER"
    assert _claims(accept.json["access_token"])["household_id"] == hid

    members = client.get(f"/api/households/{hid}/members", headers=_auth(host["access_token"]))
    assert members.status_code == 200
    assert {m["email"] for m in members.json["members"]} == {
        "host@example.com",
        "guest@example.com",
    }

    # The invitation is now consumed — a second accept fails.
    again = client.post(
        "/api/invitations/accept", json={"token": token}, headers=_auth(guest["access_token"])
    )
    assert again.status_code == 400


def test_accept_rejects_email_mismatch(client, mailbox) -> None:
    _signup(client, mailbox, "host2@example.com")
    host = _create_household(client, _login(client, "host2@example.com")["access_token"])
    invite = client.post(
        f"/api/households/{host['household']['id']}/invitations",
        json={"email": "invited@example.com", "role": "MEMBER"},
        headers=_auth(host["access_token"]),
    )
    assert invite.status_code == 201
    token = _invite_token(mailbox, "invited@example.com")

    # A *different* authenticated user cannot accept an invite bound to another email.
    _signup(client, mailbox, "wronguser@example.com")
    intruder = _login(client, "wronguser@example.com")
    r = client.post(
        "/api/invitations/accept", json={"token": token}, headers=_auth(intruder["access_token"])
    )
    assert r.status_code == 403


def test_duplicate_pending_invite_rejected(client, mailbox) -> None:
    _signup(client, mailbox, "h3@example.com")
    host = _create_household(client, _login(client, "h3@example.com")["access_token"])
    hid = host["household"]["id"]
    body = {"email": "dup@example.com", "role": "MEMBER"}
    assert client.post(
        f"/api/households/{hid}/invitations", json=body, headers=_auth(host["access_token"])
    ).status_code == 201
    second = client.post(
        f"/api/households/{hid}/invitations", json=body, headers=_auth(host["access_token"])
    )
    assert second.status_code == 409


def test_member_cannot_invite(client, mailbox) -> None:
    _signup(client, mailbox, "boss@example.com")
    host = _create_household(client, _login(client, "boss@example.com")["access_token"])
    hid = host["household"]["id"]
    invite = client.post(
        f"/api/households/{hid}/invitations",
        json={"email": "worker@example.com", "role": "MEMBER"},
        headers=_auth(host["access_token"]),
    )
    token = _invite_token(mailbox, "worker@example.com")
    _signup(client, mailbox, "worker@example.com")
    worker = _login(client, "worker@example.com")
    accepted = client.post(
        "/api/invitations/accept", json={"token": token}, headers=_auth(worker["access_token"])
    )
    assert accepted.status_code == 200

    # A MEMBER lacks member.invite → 403.
    r = client.post(
        f"/api/households/{hid}/invitations",
        json={"email": "another@example.com", "role": "MEMBER"},
        headers=_auth(accepted.json["access_token"]),
    )
    assert r.status_code == 403


def test_change_role_and_last_owner_guard(client, mailbox) -> None:
    _signup(client, mailbox, "owner3@example.com")
    owner = _create_household(client, _login(client, "owner3@example.com")["access_token"])
    hid = owner["household"]["id"]

    # The sole owner cannot be demoted nor leave — it would orphan the household.
    owner_user_id = _claims(owner["access_token"])["sub"]
    demote = client.patch(
        f"/api/households/{hid}/members/{owner_user_id}",
        json={"role": "MEMBER"},
        headers=_auth(owner["access_token"]),
    )
    assert demote.status_code == 409
    leave = client.delete(
        f"/api/households/{hid}/members/{owner_user_id}", headers=_auth(owner["access_token"])
    )
    assert leave.status_code == 409

    # Bring in a member, promote them, then the original owner can be demoted.
    invite = client.post(
        f"/api/households/{hid}/invitations",
        json={"email": "m2@example.com", "role": "MEMBER"},
        headers=_auth(owner["access_token"]),
    )
    token = _invite_token(mailbox, "m2@example.com")
    _signup(client, mailbox, "m2@example.com")
    m2 = _login(client, "m2@example.com")
    accepted = client.post(
        "/api/invitations/accept", json={"token": token}, headers=_auth(m2["access_token"])
    )
    m2_id = _claims(accepted.json["access_token"])["sub"]

    promote = client.patch(
        f"/api/households/{hid}/members/{m2_id}",
        json={"role": "OWNER"},
        headers=_auth(owner["access_token"]),
    )
    assert promote.status_code == 200
    assert promote.json["role"] == "OWNER"

    # Now two owners → demoting the first is allowed.
    demote2 = client.patch(
        f"/api/households/{hid}/members/{owner_user_id}",
        json={"role": "VIEWER"},
        headers=_auth(owner["access_token"]),
    )
    assert demote2.status_code == 200


def test_archive_then_hidden_and_unswitchable(client, mailbox) -> None:
    _signup(client, mailbox, "owner4@example.com")
    session = _login(client, "owner4@example.com")
    keep = _create_household(client, session["access_token"], "Keep")
    drop = _create_household(client, keep["access_token"], "Drop")
    drop_id = drop["household"]["id"]

    archived = client.delete(f"/api/households/{drop_id}", headers=_auth(drop["access_token"]))
    assert archived.status_code == 204

    # Soft-deleted household disappears from the list and can't be switched into.
    listing = client.get("/api/households", headers=_auth(keep["access_token"]))
    assert [h["name"] for h in listing.json["households"]] == ["Keep"]
    switch = client.post(f"/api/households/{drop_id}/switch", headers=_auth(keep["access_token"]))
    assert switch.status_code == 404


def test_archived_household_absent_from_me(client, mailbox) -> None:
    """Regression: an archived household must not leak into /me's memberships, and a stale
    access-token claim pointing at it must surface as a null active household."""
    _signup(client, mailbox, "archiver@example.com")
    session = _login(client, "archiver@example.com")
    keep = _create_household(client, session["access_token"], "Keep")
    drop = _create_household(client, keep["access_token"], "Drop")
    keep_id, drop_id = keep["household"]["id"], drop["household"]["id"]

    # Active household is Drop (created last); archive it.
    assert (
        client.delete(f"/api/households/{drop_id}", headers=_auth(drop["access_token"])).status_code
        == 204
    )

    # /me with the (now-stale) Drop token: only Keep remains, active is nulled.
    me = client.get("/api/auth/me", headers=_auth(drop["access_token"]))
    assert me.status_code == 200
    assert {m["household_name"] for m in me.json["memberships"]} == {"Keep"}
    assert me.json["active_household_id"] is None

    # A fresh login picks the only live household as active.
    relog = _login(client, "archiver@example.com")
    assert _claims(relog["access_token"])["household_id"] == keep_id
