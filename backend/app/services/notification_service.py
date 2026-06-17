"""Notification preferences + outbox scheduling (plan §4.7).

Two responsibilities:
- **Preferences** — a member reads/writes their *own* per (type, channel) opt-in. There is
  no dedicated RBAC permission: every member governs their own delivery settings, scoped to
  the token's household (RLS) and their own ``user_id`` (repo filter).
- **Scheduling** — :func:`scan_obligation_reminders` is the scheduler's daily sweep. It runs
  in the worker process's **bypass-mode** session (it spans households), so it takes a
  ``session`` rather than opening its own. Enqueue is idempotent per occurrence, so running
  the sweep twice over the same window produces no duplicate outbox rows.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from flask import current_app
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Membership, NotificationPreference, Obligation, User
from app.db.rls import session_scope
from app.domain.enums import NotificationChannel, NotificationType, ObligationStatus
from app.logging_config import get_logger
from app.repositories import notifications as notif_repo
from app.security.rbac import MembershipContext

log = get_logger("homeops.notifications")


@dataclass(frozen=True)
class PreferenceView:
    type: str
    channel: str
    enabled: bool
    lead_times: list[int]


def _to_view(pref: NotificationPreference) -> PreferenceView:
    return PreferenceView(
        type=pref.type,
        channel=pref.channel,
        enabled=pref.enabled,
        lead_times=list(pref.lead_times),
    )


# ── Preferences (member-scoped: the acting user's own rows) ───────────────────────────


def list_preferences(membership: MembershipContext) -> list[PreferenceView]:
    with session_scope(household_id=membership.household_id) as session:
        rows = notif_repo.list_preferences(
            session, user_id=membership.user_id, household_id=membership.household_id
        )
        return [_to_view(r) for r in rows]


def set_preference(
    membership: MembershipContext,
    *,
    type: str,
    channel: str,
    enabled: bool,
    lead_times: list[int],
) -> PreferenceView:
    with session_scope(household_id=membership.household_id) as session:
        pref = notif_repo.upsert_preference(
            session,
            user_id=membership.user_id,
            household_id=membership.household_id,
            type=type,
            channel=channel,
            enabled=enabled,
            lead_times=sorted({d for d in lead_times if d >= 0}),
        )
        log.info(
            "notification.preference_set",
            household_id=membership.household_id,
            type=type,
            channel=channel,
            enabled=enabled,
        )
        return _to_view(pref)


# ── Scheduling (scheduler/worker process; bypass-mode session) ────────────────────────


def _reminder_enabled(
    session: Session, *, user_id: uuid.UUID, household_id: uuid.UUID
) -> bool:
    """A reminder is on unless the member explicitly disabled OBLIGATION_DUE / EMAIL."""
    pref = notif_repo.get_preference(
        session,
        user_id=user_id,
        household_id=household_id,
        type=NotificationType.OBLIGATION_DUE.value,
        channel=NotificationChannel.EMAIL.value,
    )
    return pref is None or pref.enabled


def scan_obligation_reminders(session: Session, *, now: datetime) -> int:
    """Enqueue an OBLIGATION_DUE email for each assigned obligation entering its lead window.

    Idempotent: ``dedup_key`` keys on the obligation + its due date, so a second sweep over
    the same window enqueues nothing. Returns the number of *new* rows enqueued.
    """
    today = now.date()
    locale = current_app.config.get("MAIL_DEFAULT_LOCALE", "hu")
    rows = session.execute(
        select(Obligation, User.id, User.email)
        .join(Membership, Membership.id == Obligation.assignee_membership_id)
        .join(User, User.id == Membership.user_id)
        .where(
            Obligation.status == ObligationStatus.UPCOMING.value,
            Obligation.deleted_at.is_(None),
            Obligation.due_date >= today,
            (Obligation.due_date - Obligation.lead_time_days) <= today,
        )
    ).all()

    enqueued = 0
    for obligation, user_id, email in rows:
        if not _reminder_enabled(
            session, user_id=user_id, household_id=obligation.household_id
        ):
            continue
        created = notif_repo.enqueue(
            session,
            household_id=obligation.household_id,
            type=NotificationType.OBLIGATION_DUE.value,
            channel=NotificationChannel.EMAIL.value,
            scheduled_for=now,
            dedup_key=f"{NotificationType.OBLIGATION_DUE.value}:{obligation.id}:{obligation.due_date.isoformat()}",
            payload={
                "to": email,
                "locale": locale,
                "title": obligation.title,
                "due_date": obligation.due_date.isoformat(),
                "obligation_id": str(obligation.id),
            },
        )
        enqueued += int(created)

    log.info("notification.scan_complete", enqueued=enqueued)
    return enqueued
