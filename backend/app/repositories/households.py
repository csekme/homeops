"""Household data access (plan §4.3).

Explicit ``household_id`` filtering is kept as defense-in-depth alongside RLS. Listing a
user's households crosses tenants, so the service runs that in no-tenant mode (plan §3.6).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models import Household, Membership


def create(session: Session, *, name: str, default_currency: str) -> Household:
    household = Household(name=name, default_currency=default_currency)
    session.add(household)
    session.flush()
    return household


def get(session: Session, household_id: uuid.UUID | str) -> Household | None:
    return session.get(Household, uuid.UUID(str(household_id)))


def list_for_user(session: Session, user_id: uuid.UUID | str) -> list[tuple[Household, Membership]]:
    """Active (non-deleted) households the user belongs to, with their membership.

    Cross-tenant read — run in no-tenant mode. Returns ``(household, membership)`` pairs so
    callers can surface the user's role per household without a second query.
    """
    rows = session.execute(
        select(Household, Membership)
        .join(Membership, Membership.household_id == Household.id)
        .options(joinedload(Membership.role))
        .where(
            Membership.user_id == uuid.UUID(str(user_id)),
            Household.deleted_at.is_(None),
        )
        .order_by(Household.created_at)
    ).all()
    return [(h, m) for h, m in rows]


def soft_delete(session: Session, household: Household) -> None:
    household.deleted_at = datetime.now(UTC)
