"""Sensitive operations write an audit row with the right fields (plan §4.8 acceptance)."""

from __future__ import annotations

import pytest
from sqlalchemy import select
from tests.integration._helpers import (
    auth,
    create_household_and_switch,
    invite_and_join,
    signup,
)

from app.db.models import AuditLog
from app.db.rls import session_scope

pytestmark = pytest.mark.integration


def _audit_rows(household_id: str, action: str) -> list[AuditLog]:
    with session_scope(household_id=household_id) as session:
        return list(
            session.execute(
                select(AuditLog).where(AuditLog.action == action)
            ).scalars().all()
        )


def test_role_change_writes_one_audit_row(client, mailbox) -> None:
    owner = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, owner_scoped = create_household_and_switch(client, owner, "Home")
    _member_scoped, member_mid = invite_and_join(
        client, mailbox, owner_scoped=owner_scoped, household_id=household_id,
        email="mem@example.com", role="MEMBER", name="Mem",
    )

    changed = client.patch(
        f"/api/households/{household_id}/members/{member_mid}",
        json={"role": "VIEWER"},
        headers=auth(owner_scoped),
    )
    assert changed.status_code == 200

    rows = _audit_rows(household_id, "membership.role_updated")
    assert len(rows) == 1
    row = rows[0]
    assert str(row.target_id) == member_mid
    assert str(row.household_id) == household_id
    assert row.actor_user_id is not None  # the acting owner
    assert row.event_metadata == {"role": "VIEWER"}
    assert row.target_type == "membership"


def test_obligation_delete_is_audited(client, mailbox) -> None:
    owner = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, scoped = create_household_and_switch(client, owner, "Home")
    created = client.post(
        "/api/obligations",
        json={"title": "Bye", "due_date": "2026-06-20"},
        headers=auth(scoped),
    )
    obligation_id = created.json["id"]
    client.delete(f"/api/obligations/{obligation_id}", headers=auth(scoped))

    rows = _audit_rows(household_id, "obligation.deleted")
    assert len(rows) == 1
    assert str(rows[0].target_id) == obligation_id


def test_invitation_accept_is_audited_in_bypass_mode(client, mailbox) -> None:
    owner = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, owner_scoped = create_household_and_switch(client, owner, "Home")
    invite_and_join(
        client, mailbox, owner_scoped=owner_scoped, household_id=household_id,
        email="mem@example.com", role="MEMBER", name="Mem",
    )

    # invitation.created (tenant mode) and invitation.accepted (bypass mode) both landed.
    assert len(_audit_rows(household_id, "invitation.created")) == 1
    accepted = _audit_rows(household_id, "invitation.accepted")
    assert len(accepted) == 1
    assert accepted[0].event_metadata == {"role": "MEMBER"}
