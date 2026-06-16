"""Cross-tenant isolation at the API layer (plan §4.3 acceptance, §9 security matrix).

A member of household A must not be able to read or mutate household B — even by guessing
B's id. The controller binds every household-scoped op to the *token's* household, so a
mismatched path id is indistinguishable from "not found" (404)."""

from __future__ import annotations

import pytest
from tests.integration._helpers import (
    auth,
    create_household_and_switch,
    invitation_token,
    signup,
)

pytestmark = pytest.mark.integration


def test_member_of_a_cannot_read_or_delete_b(client, mailbox) -> None:
    alice = signup(client, mailbox, "alice@example.com", "Alice")
    _a_id, alice_scoped = create_household_and_switch(client, alice, "A-home")

    bob = signup(client, mailbox, "bob@example.com", "Bob")
    b_id, _bob_scoped = create_household_and_switch(client, bob, "B-home")

    # Alice's token is scoped to A; B's id in the path resolves to 404, not B's data.
    members = client.get(f"/api/households/{b_id}/members", headers=auth(alice_scoped))
    assert members.status_code == 404

    deleted = client.delete(f"/api/households/{b_id}", headers=auth(alice_scoped))
    assert deleted.status_code == 404


def test_admin_cannot_delete_household(client, mailbox) -> None:
    # household.delete is OWNER-only; an ADMIN is refused by the RBAC gate (403).
    owner = signup(client, mailbox, "owner@example.com")
    household_id, owner_scoped = create_household_and_switch(client, owner, "Home")
    client.post(
        "/api/invitations",
        json={"email": "admin@example.com", "role": "ADMIN"},
        headers=auth(owner_scoped),
    )

    token = invitation_token(mailbox, "admin@example.com")
    admin = signup(client, mailbox, "admin@example.com")
    client.post("/api/invitations/accept", json={"token": token}, headers=auth(admin))
    admin_scoped = client.post(
        "/api/households/switch", json={"household_id": household_id}, headers=auth(admin)
    ).json["access_token"]

    denied = client.delete(f"/api/households/{household_id}", headers=auth(admin_scoped))
    assert denied.status_code == 403
