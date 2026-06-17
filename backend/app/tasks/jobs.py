"""Scheduled jobs (plan §4.7). Thin wrappers that open the bypass-mode session the
cross-household sweeps need and delegate to the service layer."""

from __future__ import annotations

from datetime import UTC, datetime

from app.db.rls import session_scope
from app.services import notification_service


def scan_obligation_reminders(*, now: datetime | None = None) -> int:
    """Daily sweep: enqueue OBLIGATION_DUE reminders. Idempotent — safe to re-run."""
    now = now or datetime.now(UTC)
    with session_scope(bypass_tenant=True) as session:
        return notification_service.scan_obligation_reminders(session, now=now)
