"""Shared helpers for the Phase 1 household/invitation integration tests."""

from __future__ import annotations

import re

PASSWORD = "correct horse battery staple"


def _activation_token(mailbox, email: str) -> str:
    msg = next(m for m in reversed(mailbox.sent) if m.to == email and "/activate/" in m.text_body)
    return re.search(r"/activate/([A-Za-z0-9_-]+)", msg.text_body).group(1)


def invitation_token(mailbox, email: str) -> str:
    msg = next(m for m in reversed(mailbox.sent) if m.to == email and "/invite/" in m.text_body)
    return re.search(r"/invite/([A-Za-z0-9_-]+)", msg.text_body).group(1)


def signup(client, mailbox, email: str, display_name: str = "User") -> str:
    """Register → activate → login. Returns a fresh access token (no household yet)."""
    r = client.post(
        "/api/auth/register",
        json={"email": email, "password": PASSWORD, "display_name": display_name},
    )
    assert r.status_code == 202, r.json
    client.post("/api/auth/activate", json={"token": _activation_token(mailbox, email)})
    login = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert login.status_code == 200, login.json
    return login.json["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_household_and_switch(
    client, token: str, name: str, currency: str = "HUF"
) -> tuple[str, str]:
    """Create a household as the given user and switch into it.

    Returns ``(household_id, household_scoped_token)``."""
    created = client.post(
        "/api/households", json={"name": name, "default_currency": currency}, headers=auth(token)
    )
    assert created.status_code == 201, created.json
    household_id = created.json["id"]
    switched = client.post(
        "/api/households/switch",
        json={"household_id": household_id},
        headers=auth(token),
    )
    assert switched.status_code == 200, switched.json
    return household_id, switched.json["access_token"]


def invite_and_join(
    client,
    mailbox,
    *,
    owner_scoped: str,
    household_id: str,
    email: str,
    role: str,
    name: str = "Member",
) -> tuple[str, str]:
    """Owner invites ``email`` with ``role``; that user signs up, accepts and switches in.

    Returns ``(member_scoped_token, membership_id)``."""
    invited = client.post(
        "/api/invitations", json={"email": email, "role": role}, headers=auth(owner_scoped)
    )
    assert invited.status_code == 202, invited.json

    token = signup(client, mailbox, email, name)
    accepted = client.post(
        "/api/invitations/accept",
        json={"token": invitation_token(mailbox, email)},
        headers=auth(token),
    )
    assert accepted.status_code == 200, accepted.json

    switched = client.post(
        "/api/households/switch", json={"household_id": household_id}, headers=auth(token)
    )
    assert switched.status_code == 200, switched.json
    member_scoped = switched.json["access_token"]

    members = client.get(
        f"/api/households/{household_id}/members", headers=auth(owner_scoped)
    ).json
    membership_id = next(m["membership_id"] for m in members if m["email"] == email)
    return member_scoped, membership_id
