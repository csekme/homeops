"""Household data access (feature plan §Backend).

Cross-household reads (``list_for_user``, ``get_for_user``) run in no-tenant mode at the
service layer; the single-household reads run inside a tenant scope where RLS already
constrains the rows. Soft-deleted households (``deleted_at IS NOT NULL``) are excluded
everywhere — RLS does not filter on ``deleted_at``, so the app layer must.
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


def get_by_id(session: Session, household_id: uuid.UUID | str) -> Household | None:
    """Return a live (non-deleted) household by id, or None."""
    return session.execute(
        select(Household).where(
            Household.id == uuid.UUID(str(household_id)),
            Household.deleted_at.is_(None),
        )
    ).scalar_one_or_none()


def list_for_user(session: Session, user_id: uuid.UUID | str) -> list[Membership]:
    """Memberships (with household + role eager-loaded) for a user, excluding soft-deleted
    households. Cross-household → runs in no-tenant mode at the service layer."""
    return list(
        session.execute(
            select(Membership)
            .join(Household, Membership.household_id == Household.id)
            .options(joinedload(Membership.role), joinedload(Membership.household))
            .where(
                Membership.user_id == uuid.UUID(str(user_id)),
                Household.deleted_at.is_(None),
            )
            .order_by(Membership.created_at)
        )
        .scalars()
        .all()
    )


def rename(session: Session, household: Household, *, name: str) -> Household:
    household.name = name
    session.flush()
    return household


def soft_delete(session: Session, household: Household) -> Household:
    household.deleted_at = datetime.now(UTC)
    session.flush()
    return household
