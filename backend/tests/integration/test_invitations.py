"""Invitation flow (plan §4.3 acceptance): invite → email → accept → membership."""

from __future__ import annotations

import pytest
from tests.integration._helpers import (
    auth,
    create_household_and_switch,
    invitation_token,
    signup,
)

pytestmark = pytest.mark.integration


def test_invite_email_accept_grants_membership(client, mailbox) -> None:
    owner = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, owner_scoped = create_household_and_switch(client, owner, "Home")

    invite = client.post(
        "/api/invitations",
        json={"email": "bob@example.com", "role": "MEMBER"},
        headers=auth(owner_scoped),
    )
    assert invite.status_code == 202
    token = invitation_token(mailbox, "bob@example.com")

    bob = signup(client, mailbox, "bob@example.com", "Bob")
    accepted = client.post("/api/invitations/accept", json={"token": token}, headers=auth(bob))
    assert accepted.status_code == 200

    # Bob can switch into the household and lands with the invited role.
    switched = client.post(
        "/api/households/switch", json={"household_id": household_id}, headers=auth(bob)
    )
    assert switched.status_code == 200
    assert switched.json["role"] == "MEMBER"

    members = client.get(f"/api/households/{household_id}/members", headers=auth(owner_scoped))
    assert {m["email"] for m in members.json} == {"owner@example.com", "bob@example.com"}


def test_accept_invalid_token_is_400(client, mailbox) -> None:
    bob = signup(client, mailbox, "bob2@example.com")
    r = client.post("/api/invitations/accept", json={"token": "nope"}, headers=auth(bob))
    assert r.status_code == 400


def test_accept_twice_is_conflict(client, mailbox) -> None:
    owner = signup(client, mailbox, "owner4@example.com")
    _hid, owner_scoped = create_household_and_switch(client, owner, "Home")
    client.post(
        "/api/invitations",
        json={"email": "carol@example.com", "role": "VIEWER"},
        headers=auth(owner_scoped),
    )
    token = invitation_token(mailbox, "carol@example.com")
    carol = signup(client, mailbox, "carol@example.com")

    first = client.post("/api/invitations/accept", json={"token": token}, headers=auth(carol))
    assert first.status_code == 200
    second = client.post("/api/invitations/accept", json={"token": token}, headers=auth(carol))
    # Token already consumed → invalid (400). (A re-issued token to an existing member
    # would instead yield 409; covered by the service-level AlreadyMember guard.)
    assert second.status_code == 400


def test_member_cannot_invite(client, mailbox) -> None:
    owner = signup(client, mailbox, "owner5@example.com")
    household_id, owner_scoped = create_household_and_switch(client, owner, "Home")
    client.post(
        "/api/invitations",
        json={"email": "dave@example.com", "role": "MEMBER"},
        headers=auth(owner_scoped),
    )
    token = invitation_token(mailbox, "dave@example.com")
    dave = signup(client, mailbox, "dave@example.com")
    client.post("/api/invitations/accept", json={"token": token}, headers=auth(dave))
    dave_scoped = client.post(
        "/api/households/switch", json={"household_id": household_id}, headers=auth(dave)
    ).json["access_token"]

    # MEMBER lacks member.invite → 403 from the RBAC gate.
    denied = client.post(
        "/api/invitations",
        json={"email": "eve@example.com", "role": "MEMBER"},
        headers=auth(dave_scoped),
    )
    assert denied.status_code == 403
