"""Membership data access (plan §4.3). Tenant-scoped reads also keep an explicit
``household_id`` predicate as defense-in-depth alongside RLS."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models import Membership


def add(
    session: Session,
    *,
    user_id: uuid.UUID | str,
    household_id: uuid.UUID | str,
    role_id: uuid.UUID | str,
) -> Membership:
    membership = Membership(
        user_id=uuid.UUID(str(user_id)),
        household_id=uuid.UUID(str(household_id)),
        role_id=uuid.UUID(str(role_id)),
    )
    session.add(membership)
    session.flush()
    return membership


def get(session: Session, membership_id: uuid.UUID | str) -> Membership | None:
    return session.get(Membership, uuid.UUID(str(membership_id)))


def get_for_user_household(
    session: Session, *, user_id: uuid.UUID | str, household_id: uuid.UUID | str
) -> Membership | None:
    return session.execute(
        select(Membership)
        .options(joinedload(Membership.role))
        .where(
            Membership.user_id == uuid.UUID(str(user_id)),
            Membership.household_id == uuid.UUID(str(household_id)),
        )
    ).scalar_one_or_none()


def list_by_household(session: Session, household_id: uuid.UUID | str) -> list[Membership]:
    return list(
        session.execute(
            select(Membership)
            .options(joinedload(Membership.role), joinedload(Membership.user))
            .where(Membership.household_id == uuid.UUID(str(household_id)))
            .order_by(Membership.created_at)
        )
        .scalars()
        .all()
    )


def update_role(session: Session, membership: Membership, *, role_id: uuid.UUID | str) -> None:
    membership.role_id = uuid.UUID(str(role_id))


def remove(session: Session, membership: Membership) -> None:
    session.delete(membership)
