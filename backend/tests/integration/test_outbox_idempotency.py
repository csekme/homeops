"""Scheduling the same reminder window twice produces no duplicate outbox rows
(plan §4.7 acceptance — idempotency via dedup_key + ON CONFLICT DO NOTHING)."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from tests.integration._helpers import auth, create_household_and_switch, signup

from app.db.models import Notification
from app.db.rls import session_scope
from app.tasks import jobs

pytestmark = pytest.mark.integration

_NOW = datetime(2026, 6, 17, 8, 0, tzinfo=UTC)


def _owner_membership_id(client, scoped: str, household_id: str) -> str:
    members = client.get(f"/api/households/{household_id}/members", headers=auth(scoped)).json
    return members[0]["membership_id"]


def _notifications() -> list[Notification]:
    with session_scope(bypass_tenant=True) as session:
        return list(session.execute(select(Notification)).scalars().all())


def test_double_scan_enqueues_once(app, client, mailbox) -> None:
    token = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, scoped = create_household_and_switch(client, token, "Home")
    assignee = _owner_membership_id(client, scoped, household_id)
    client.post(
        "/api/obligations",
        json={"title": "Pay rent", "due_date": "2026-06-17", "assignee_membership_id": assignee},
        headers=auth(scoped),
    )

    with app.app_context():
        first = jobs.scan_obligation_reminders(now=_NOW)
        second = jobs.scan_obligation_reminders(now=_NOW)

    assert first == 1
    assert second == 0
    rows = _notifications()
    assert len(rows) == 1
    assert rows[0].type == "OBLIGATION_DUE"
    assert rows[0].status == "PENDING"
    assert rows[0].payload["to"] == "owner@example.com"


def test_disabled_preference_skips_enqueue(app, client, mailbox) -> None:
    token = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, scoped = create_household_and_switch(client, token, "Home")
    assignee = _owner_membership_id(client, scoped, household_id)
    client.post(
        "/api/obligations",
        json={"title": "Pay rent", "due_date": "2026-06-17", "assignee_membership_id": assignee},
        headers=auth(scoped),
    )
    # Opt out of OBLIGATION_DUE / EMAIL.
    client.put(
        "/api/notification-preferences",
        json={"type": "OBLIGATION_DUE", "channel": "EMAIL", "enabled": False, "lead_times": []},
        headers=auth(scoped),
    )

    with app.app_context():
        enqueued = jobs.scan_obligation_reminders(now=_NOW)

    assert enqueued == 0
    assert _notifications() == []
