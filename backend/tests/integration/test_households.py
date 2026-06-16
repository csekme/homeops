"""Household + membership flows (plan §4.3 acceptance)."""

from __future__ import annotations

import uuid

import pytest
from tests.integration._helpers import auth, create_household_and_switch, signup

pytestmark = pytest.mark.integration


def test_create_makes_owner_and_lists(client, mailbox) -> None:
    token = signup(client, mailbox, "owner@example.com", "Owner")

    created = client.post(
        "/api/households", json={"name": "Home", "default_currency": "HUF"}, headers=auth(token)
    )
    assert created.status_code == 201
    assert created.json["role"] == "OWNER"
    assert created.json["name"] == "Home"

    listed = client.get("/api/households", headers=auth(token))
    assert listed.status_code == 200
    assert len(listed.json) == 1
    assert listed.json[0]["role"] == "OWNER"


def test_switch_issues_token_scoped_to_household(client, mailbox) -> None:
    token = signup(client, mailbox, "owner2@example.com", "Owner")
    household_id, scoped = create_household_and_switch(client, token, "Home")

    # The scoped token now works for a household-scoped endpoint; the owner is listed.
    members = client.get(f"/api/households/{household_id}/members", headers=auth(scoped))
    assert members.status_code == 200
    assert len(members.json) == 1
    assert members.json[0]["role"] == "OWNER"
    assert members.json[0]["email"] == "owner2@example.com"


def test_switch_to_unknown_household_is_404(client, mailbox) -> None:
    token = signup(client, mailbox, "nomad@example.com")
    r = client.post(
        "/api/households/switch",
        json={"household_id": str(uuid.uuid4())},
        headers=auth(token),
    )
    assert r.status_code == 404


def test_household_scoped_endpoint_without_membership_is_403(client, mailbox) -> None:
    # A freshly signed-up user has no active household → token carries no household claim.
    token = signup(client, mailbox, "lonely@example.com")
    r = client.post("/api/invitations", json={"email": "x@example.com", "role": "MEMBER"},
                    headers=auth(token))
    assert r.status_code == 403


def test_owner_can_soft_delete_household(client, mailbox) -> None:
    token = signup(client, mailbox, "owner3@example.com")
    household_id, scoped = create_household_and_switch(client, token, "Home")

    deleted = client.delete(f"/api/households/{household_id}", headers=auth(scoped))
    assert deleted.status_code == 204

    # Soft-deleted households drop out of the user's list.
    listed = client.get("/api/households", headers=auth(token))
    assert listed.json == []
