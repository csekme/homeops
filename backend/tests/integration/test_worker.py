"""Outbox worker: SKIP LOCKED concurrency, retry/backoff to DEAD, and a clean send
(plan §4.7 acceptance — no double send, failures retry then park, one email delivered)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select
from tests.integration._helpers import create_household_and_switch, signup

from app.db.models import Notification
from app.db.rls import apply_tenant_context, session_scope
from app.db.session import db
from app.repositories import notifications as notif_repo
from app.tasks.notification_worker import run_once

pytestmark = pytest.mark.integration

_NOW = datetime(2026, 6, 17, 8, 0, tzinfo=UTC)


class _FailingSender:
    def send(self, message) -> None:
        raise RuntimeError("smtp down")


def _household(client, mailbox, email="owner@example.com") -> str:
    token = signup(client, mailbox, email, "Owner")
    household_id, _scoped = create_household_and_switch(client, token, "Home")
    return household_id


def _enqueue(household_id: str, *, dedup_key: str, scheduled_for: datetime) -> None:
    with session_scope(bypass_tenant=True) as session:
        notif_repo.enqueue(
            session,
            household_id=household_id,
            type="OBLIGATION_DUE",
            channel="EMAIL",
            scheduled_for=scheduled_for,
            dedup_key=dedup_key,
            payload={
                "to": "owner@example.com",
                "title": "Pay rent",
                "due_date": "2026-06-17",
                "obligation_id": "00000000-0000-0000-0000-000000000000",
            },
        )


def _status(notification_id) -> Notification:
    with session_scope(bypass_tenant=True) as session:
        return session.get(Notification, notification_id)


def test_skip_locked_prevents_double_claim(app, client, mailbox) -> None:
    household_id = _household(client, mailbox)
    _enqueue(household_id, dedup_key="k1", scheduled_for=_NOW)

    with app.app_context():
        # Two concurrent transactions both try to claim. The first locks the only row;
        # the second skips it (SKIP LOCKED) and gets nothing — never a double send.
        sa = db.new_session()
        sb = db.new_session()
        try:
            sa.begin()
            apply_tenant_context(sa, household_id=None, bypass_tenant=True)
            sb.begin()
            apply_tenant_context(sb, household_id=None, bypass_tenant=True)

            claimed_a = notif_repo.claim_batch(sa, limit=10, now=_NOW)
            claimed_b = notif_repo.claim_batch(sb, limit=10, now=_NOW)

            assert len(claimed_a) == 1
            assert len(claimed_b) == 0
        finally:
            sa.rollback()
            sb.rollback()
            sa.close()
            sb.close()


def test_send_marks_sent_and_delivers_one_email(app, client, mailbox) -> None:
    household_id = _household(client, mailbox)
    _enqueue(household_id, dedup_key="k1", scheduled_for=_NOW)
    mailbox.sent.clear()  # drop the signup activation email — assert only on the reminder

    with app.app_context():
        result = run_once(now=_NOW)

    assert (result.claimed, result.sent, result.failed, result.dead) == (1, 1, 0, 0)
    assert len(mailbox.sent) == 1
    assert mailbox.sent[0].to == "owner@example.com"

    with session_scope(bypass_tenant=True) as session:
        statuses = session.execute(select(Notification.status)).scalars().all()
    assert statuses == ["SENT"]


def test_failures_retry_with_backoff_then_dead(app, client, mailbox) -> None:
    household_id = _household(client, mailbox)
    _enqueue(household_id, dedup_key="k1", scheduled_for=_NOW)

    app.config["NOTIFICATION_MAX_ATTEMPTS"] = 3
    app.config["NOTIFICATION_BACKOFF_BASE_SECONDS"] = 1
    app.extensions["email_sender"] = _FailingSender()

    with session_scope(bypass_tenant=True) as session:
        notification_id = session.execute(select(Notification.id)).scalar_one()

    with app.app_context():
        # Each tick must run after the prior backoff elapses to re-claim the FAILED row.
        r1 = run_once(now=_NOW)
        assert (r1.failed, r1.dead) == (1, 0)
        r2 = run_once(now=_NOW + timedelta(seconds=10))
        assert (r2.failed, r2.dead) == (1, 0)
        r3 = run_once(now=_NOW + timedelta(seconds=100))
        assert (r3.failed, r3.dead) == (0, 1)

    row = _status(notification_id)
    assert row.status == "DEAD"
    assert row.attempts == 3
    assert row.last_error == "smtp down"  # the failing sender's error, never delivered


def test_not_yet_due_rows_are_left_alone(app, client, mailbox) -> None:
    household_id = _household(client, mailbox)
    _enqueue(household_id, dedup_key="future", scheduled_for=_NOW + timedelta(hours=1))

    with app.app_context():
        result = run_once(now=_NOW)

    assert result.claimed == 0
    with session_scope(bypass_tenant=True) as session:
        pending = session.execute(
            select(func.count()).select_from(Notification).where(Notification.status == "PENDING")
        ).scalar_one()
    assert pending == 1
