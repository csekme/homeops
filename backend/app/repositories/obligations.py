"""Obligation data access (plan §4.4).

Explicit ``household_id`` filtering is kept as defense-in-depth alongside RLS. Soft-deleted
rows (``deleted_at IS NOT NULL``) are excluded from every read.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Obligation


def create(
    session: Session,
    *,
    household_id: uuid.UUID | str,
    title: str,
    description: str | None,
    category: str | None,
    due_date: date,
    rrule: str | None,
    status: str,
    assignee_membership_id: uuid.UUID | str | None,
    estimated_amount_minor: int | None,
    actual_amount_minor: int | None,
    currency: str | None,
    lead_time_days: int,
) -> Obligation:
    obligation = Obligation(
        household_id=uuid.UUID(str(household_id)),
        title=title,
        description=description,
        category=category,
        due_date=due_date,
        rrule=rrule,
        status=status,
        assignee_membership_id=(
            uuid.UUID(str(assignee_membership_id)) if assignee_membership_id else None
        ),
        estimated_amount_minor=estimated_amount_minor,
        actual_amount_minor=actual_amount_minor,
        currency=currency,
        lead_time_days=lead_time_days,
    )
    session.add(obligation)
    session.flush()
    return obligation


def get(
    session: Session, *, household_id: uuid.UUID | str, obligation_id: uuid.UUID | str
) -> Obligation | None:
    return session.execute(
        select(Obligation).where(
            Obligation.id == uuid.UUID(str(obligation_id)),
            Obligation.household_id == uuid.UUID(str(household_id)),
            Obligation.deleted_at.is_(None),
        )
    ).scalar_one_or_none()


def list_(
    session: Session,
    *,
    household_id: uuid.UUID | str,
    status: str | None = None,
    assignee_membership_id: uuid.UUID | str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
) -> list[Obligation]:
    stmt = (
        select(Obligation)
        .where(
            Obligation.household_id == uuid.UUID(str(household_id)),
            Obligation.deleted_at.is_(None),
        )
        .order_by(Obligation.due_date, Obligation.created_at)
    )
    if status is not None:
        stmt = stmt.where(Obligation.status == status)
    if assignee_membership_id is not None:
        stmt = stmt.where(
            Obligation.assignee_membership_id == uuid.UUID(str(assignee_membership_id))
        )
    if due_from is not None:
        stmt = stmt.where(Obligation.due_date >= due_from)
    if due_to is not None:
        stmt = stmt.where(Obligation.due_date <= due_to)
    return list(session.execute(stmt).scalars().all())


def update(session: Session, obligation: Obligation, **fields: object) -> None:
    for key, value in fields.items():
        setattr(obligation, key, value)
    session.flush()


def soft_delete(session: Session, obligation: Obligation) -> None:
    obligation.deleted_at = datetime.now(UTC)
