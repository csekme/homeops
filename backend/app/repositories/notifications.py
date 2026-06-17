"""Outbox + preference data access (plan §4.7).

The two load-bearing queries:
- :func:`enqueue` — ``INSERT ... ON CONFLICT (dedup_key) DO NOTHING`` makes scheduling
  idempotent: re-scanning the same window inserts nothing the second time.
- :func:`claim_batch` — ``SELECT ... FOR UPDATE SKIP LOCKED`` lets several worker processes
  drain the outbox concurrently without ever handing the same row to two of them.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.db.models import Notification, NotificationPreference
from app.domain.enums import NotificationStatus


def enqueue(
    session: Session,
    *,
    household_id: uuid.UUID | str,
    type: str,
    channel: str,
    scheduled_for: datetime,
    dedup_key: str,
    payload: dict,
) -> bool:
    """Idempotent insert. Returns ``True`` if a new row landed, ``False`` on conflict."""
    stmt = (
        pg_insert(Notification)
        .values(
            household_id=uuid.UUID(str(household_id)),
            type=type,
            channel=channel,
            status=NotificationStatus.PENDING.value,
            scheduled_for=scheduled_for,
            dedup_key=dedup_key,
            payload=payload,
            attempts=0,
        )
        .on_conflict_do_nothing(index_elements=["dedup_key"])
        .returning(Notification.id)
    )
    return session.execute(stmt).scalar_one_or_none() is not None


def claim_batch(session: Session, *, limit: int, now: datetime) -> list[Notification]:
    """Lock and return up to ``limit`` due rows, skipping rows another worker holds."""
    stmt = (
        select(Notification)
        .where(
            Notification.status.in_(
                [NotificationStatus.PENDING.value, NotificationStatus.FAILED.value]
            ),
            Notification.scheduled_for <= now,
            or_(Notification.next_attempt_at.is_(None), Notification.next_attempt_at <= now),
        )
        .order_by(Notification.scheduled_for)
        .limit(limit)
        .with_for_update(skip_locked=True)
    )
    return list(session.execute(stmt).scalars().all())


def mark_sent(session: Session, notification: Notification) -> None:
    notification.status = NotificationStatus.SENT.value


def mark_failed(
    session: Session, notification: Notification, *, error: str, next_attempt_at: datetime
) -> None:
    notification.status = NotificationStatus.FAILED.value
    notification.attempts += 1
    notification.last_error = error
    notification.next_attempt_at = next_attempt_at


def mark_dead(session: Session, notification: Notification, *, error: str) -> None:
    notification.status = NotificationStatus.DEAD.value
    notification.attempts += 1
    notification.last_error = error


def list_preferences(
    session: Session, *, user_id: uuid.UUID | str, household_id: uuid.UUID | str
) -> list[NotificationPreference]:
    return list(
        session.execute(
            select(NotificationPreference)
            .where(
                NotificationPreference.user_id == uuid.UUID(str(user_id)),
                NotificationPreference.household_id == uuid.UUID(str(household_id)),
            )
            .order_by(NotificationPreference.type, NotificationPreference.channel)
        )
        .scalars()
        .all()
    )


def get_preference(
    session: Session,
    *,
    user_id: uuid.UUID | str,
    household_id: uuid.UUID | str,
    type: str,
    channel: str,
) -> NotificationPreference | None:
    return session.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == uuid.UUID(str(user_id)),
            NotificationPreference.household_id == uuid.UUID(str(household_id)),
            NotificationPreference.type == type,
            NotificationPreference.channel == channel,
        )
    ).scalar_one_or_none()


def upsert_preference(
    session: Session,
    *,
    user_id: uuid.UUID | str,
    household_id: uuid.UUID | str,
    type: str,
    channel: str,
    enabled: bool,
    lead_times: list[int],
) -> NotificationPreference:
    pref = get_preference(
        session, user_id=user_id, household_id=household_id, type=type, channel=channel
    )
    if pref is None:
        pref = NotificationPreference(
            user_id=uuid.UUID(str(user_id)),
            household_id=uuid.UUID(str(household_id)),
            type=type,
            channel=channel,
            enabled=enabled,
            lead_times=lead_times,
        )
        session.add(pref)
    else:
        pref.enabled = enabled
        pref.lead_times = lead_times
    session.flush()
    return pref
