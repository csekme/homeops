"""End-to-end "my invitations" inbox + decline (feature plan §#4):

GET /api/invitations/mine surfaces pending invites addressed to the signed-in user; accept
and decline work by invitation id (dashboard) as well as by token (invite-link page). Decline
is distinct from inviter revocation and frees the (household, email) slot for a re-invite.
"""

from __future__ import annotations

import re

import jwt
import pytest

pytestmark = pytest.mark.integration

PASSWORD = "correct horse battery staple"
JWT_SECRET = "x" * 40
BEARER = {"X-Auth-Transport": "bearer"}


def _last_token(mailbox, email: str, kind: str) -> str:
    pattern = re.compile(rf"/{kind}/([A-Za-z0-9_-]+)")
    for msg in reversed(mailbox.sent):
        if msg.to == email and (m := pattern.search(msg.text_body)):
            return m.group(1)
    raise AssertionError(f"no /{kind}/ link emailed to {email}")


def _signup(client, mailbox, email: str) -> None:
    assert client.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD, "display_name": "User"},
    ).status_code == 202
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


def _host_with_invite(client, mailbox, *, host_email: str, guest_email: str) -> dict:
    """Create a household for the host and send a pending invite to ``guest_email``."""
    _signup(client, mailbox, host_email)
    host_access = _login(client, host_email)["access_token"]
    host = client.post(
        "/api/households", json={"name": "Flat"}, headers=_auth(host_access)
    ).json
    invite = client.post(
        f"/api/households/{host['household']['id']}/invitations",
        json={"email": guest_email, "role": "MEMBER"},
        headers=_auth(host["access_token"]),
    )
    assert invite.status_code == 201
    return host


def test_mine_lists_pending_invitations_for_caller(client, mailbox) -> None:
    host = _host_with_invite(
        client, mailbox, host_email="host@example.com", guest_email="guest@example.com"
    )
    hid = host["household"]["id"]

    _signup(client, mailbox, "guest@example.com")
    guest = _login(client, "guest@example.com")

    mine = client.get("/api/invitations/mine", headers=_auth(guest["access_token"]))
    assert mine.status_code == 200
    invitations = mine.json["invitations"]
    assert len(invitations) == 1
    assert invitations[0]["household_name"] == "Flat"
    assert invitations[0]["role"] == "MEMBER"
    assert invitations[0]["email"] == "guest@example.com"
    assert invitations[0]["id"]

    # Accept by id (the dashboard path, where the raw token isn't available).
    accept = client.post(
        "/api/invitations/accept",
        json={"invitation_id": invitations[0]["id"]},
        headers=_auth(guest["access_token"]),
    )
    assert accept.status_code == 200
    assert accept.json["household"]["role"] == "MEMBER"
    assert jwt.decode(accept.json["access_token"], JWT_SECRET, algorithms=["HS256"])[
        "household_id"
    ] == hid

    # Once accepted it no longer shows up as pending.
    after = client.get("/api/invitations/mine", headers=_auth(guest["access_token"]))
    assert after.json["invitations"] == []


def test_decline_by_id_removes_invite_and_allows_reinvite(client, mailbox) -> None:
    host = _host_with_invite(
        client, mailbox, host_email="host2@example.com", guest_email="guest2@example.com"
    )
    hid = host["household"]["id"]

    _signup(client, mailbox, "guest2@example.com")
    guest = _login(client, "guest2@example.com")
    inv_id = client.get("/api/invitations/mine", headers=_auth(guest["access_token"])).json[
        "invitations"
    ][0]["id"]

    declined = client.post(
        "/api/invitations/decline",
        json={"invitation_id": inv_id},
        headers=_auth(guest["access_token"]),
    )
    assert declined.status_code == 204

    # Gone from the inbox, and not silently joined.
    assert client.get("/api/invitations/mine", headers=_auth(guest["access_token"])).json[
        "invitations"
    ] == []

    # A declined invite frees the slot: the host can invite the same email again.
    reinvite = client.post(
        f"/api/households/{hid}/invitations",
        json={"email": "guest2@example.com", "role": "MEMBER"},
        headers=_auth(host["access_token"]),
    )
    assert reinvite.status_code == 201


def test_decline_by_token_from_invite_link(client, mailbox) -> None:
    _host_with_invite(
        client, mailbox, host_email="host3@example.com", guest_email="guest3@example.com"
    )
    token = _last_token(mailbox, "guest3@example.com", "invite")

    _signup(client, mailbox, "guest3@example.com")
    guest = _login(client, "guest3@example.com")

    declined = client.post(
        "/api/invitations/decline", json={"token": token}, headers=_auth(guest["access_token"])
    )
    assert declined.status_code == 204

    # A declined invitation can no longer be accepted (it's no longer pending).
    accept = client.post(
        "/api/invitations/accept", json={"token": token}, headers=_auth(guest["access_token"])
    )
    assert accept.status_code == 400


def test_decline_rejects_email_mismatch(client, mailbox) -> None:
    _host_with_invite(
        client, mailbox, host_email="host4@example.com", guest_email="invited4@example.com"
    )
    token = _last_token(mailbox, "invited4@example.com", "invite")

    # A different authenticated user cannot decline an invite bound to another email.
    _signup(client, mailbox, "intruder4@example.com")
    intruder = _login(client, "intruder4@example.com")
    r = client.post(
        "/api/invitations/decline", json={"token": token}, headers=_auth(intruder["access_token"])
    )
    assert r.status_code == 403


def test_decline_requires_an_identifier(client, mailbox) -> None:
    _signup(client, mailbox, "lonely@example.com")
    user = _login(client, "lonely@example.com")
    r = client.post("/api/invitations/decline", json={}, headers=_auth(user["access_token"]))
    assert r.status_code == 400
