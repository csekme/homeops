"""CHILD obligation scoping is enforced server-side (plan §4.4 acceptance, §9 matrix).

A CHILD may only *read* the obligations assigned to them — never the whole household's —
and may not write at all. This is enforced in the service, not the UI: a CHILD listing
obligations is forced to their own assignee filter, and any write hits the RBAC gate (403).
"""

from __future__ import annotations

import pytest
from tests.integration._helpers import (
    auth,
    create_household_and_switch,
    invite_and_join,
    signup,
)

pytestmark = pytest.mark.integration


def _household_with_child(client, mailbox):
    owner = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, owner_scoped = create_household_and_switch(client, owner, "Home")
    child_scoped, child_membership_id = invite_and_join(
        client,
        mailbox,
        owner_scoped=owner_scoped,
        household_id=household_id,
        email="kid@example.com",
        role="CHILD",
        name="Kid",
    )
    _member_scoped, member_membership_id = invite_and_join(
        client,
        mailbox,
        owner_scoped=owner_scoped,
        household_id=household_id,
        email="mem@example.com",
        role="MEMBER",
        name="Mem",
    )
    return {
        "owner_scoped": owner_scoped,
        "child_scoped": child_scoped,
        "child_membership_id": child_membership_id,
        "member_membership_id": member_membership_id,
    }


def test_child_lists_only_their_own_assignments(client, mailbox) -> None:
    ctx = _household_with_child(client, mailbox)

    # One obligation assigned to the child, one to the member.
    client.post(
        "/api/obligations",
        json={
            "title": "Child chore",
            "due_date": "2026-06-20",
            "assignee_membership_id": ctx["child_membership_id"],
        },
        headers=auth(ctx["owner_scoped"]),
    )
    client.post(
        "/api/obligations",
        json={
            "title": "Member task",
            "due_date": "2026-06-20",
            "assignee_membership_id": ctx["member_membership_id"],
        },
        headers=auth(ctx["owner_scoped"]),
    )

    # Owner sees both; the child sees only the chore assigned to them.
    assert len(client.get("/api/obligations", headers=auth(ctx["owner_scoped"])).json) == 2
    child_list = client.get("/api/obligations", headers=auth(ctx["child_scoped"])).json
    assert [o["title"] for o in child_list] == ["Child chore"]


def test_child_cannot_read_another_members_obligation_directly(client, mailbox) -> None:
    ctx = _household_with_child(client, mailbox)
    created = client.post(
        "/api/obligations",
        json={
            "title": "Member task",
            "due_date": "2026-06-20",
            "assignee_membership_id": ctx["member_membership_id"],
        },
        headers=auth(ctx["owner_scoped"]),
    )
    # Even by id, a CHILD cannot read an obligation not assigned to them → 404.
    r = client.get(f"/api/obligations/{created.json['id']}", headers=auth(ctx["child_scoped"]))
    assert r.status_code == 404


def test_child_writes_are_forbidden(client, mailbox) -> None:
    ctx = _household_with_child(client, mailbox)
    created = client.post(
        "/api/obligations",
        json={
            "title": "Child chore",
            "due_date": "2026-06-20",
            "assignee_membership_id": ctx["child_membership_id"],
        },
        headers=auth(ctx["owner_scoped"]),
    )
    obligation_id = created.json["id"]

    create = client.post(
        "/api/obligations",
        json={"title": "Nope", "due_date": "2026-06-20"},
        headers=auth(ctx["child_scoped"]),
    )
    assert create.status_code == 403

    complete = client.post(
        f"/api/obligations/{obligation_id}/complete", headers=auth(ctx["child_scoped"])
    )
    assert complete.status_code == 403

    deleted = client.delete(
        f"/api/obligations/{obligation_id}", headers=auth(ctx["child_scoped"])
    )
    assert deleted.status_code == 403
