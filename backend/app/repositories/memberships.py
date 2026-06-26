"""Membership data access (feature plan §Backend).

The active-household membership lookup (``get``) is the authoritative source for
authorization — services re-read it rather than trusting the JWT ``role`` claim, which is
stale after a role change.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.db.models import Membership, Role
from app.domain.enums import Role as RoleEnum


def get(
    session: Session, *, user_id: uuid.UUID | str, household_id: uuid.UUID | str
) -> Membership | None:
    """The user's membership in a household (role eager-loaded), or None."""
    return session.execute(
        select(Membership)
        .options(joinedload(Membership.role), joinedload(Membership.user))
        .where(
            Membership.user_id == uuid.UUID(str(user_id)),
            Membership.household_id == uuid.UUID(str(household_id)),
        )
    ).scalar_one_or_none()


def get_by_id(session: Session, membership_id: uuid.UUID | str) -> Membership | None:
    return session.execute(
        select(Membership)
        .options(joinedload(Membership.role), joinedload(Membership.user))
        .where(Membership.id == uuid.UUID(str(membership_id)))
    ).scalar_one_or_none()


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


def list_for_household(session: Session, household_id: uuid.UUID | str) -> list[Membership]:
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


def change_role(
    session: Session, membership: Membership, *, role_id: uuid.UUID | str
) -> Membership:
    membership.role_id = uuid.UUID(str(role_id))
    session.flush()
    return membership


def remove(session: Session, membership: Membership) -> None:
    session.delete(membership)
    session.flush()


def count_owners(session: Session, household_id: uuid.UUID | str) -> int:
    """How many OWNER memberships a household has — drives the last-owner guard."""
    return int(
        session.execute(
            select(func.count())
            .select_from(Membership)
            .join(Role, Membership.role_id == Role.id)
            .where(
                Membership.household_id == uuid.UUID(str(household_id)),
                Role.name == RoleEnum.OWNER.value,
            )
        ).scalar_one()
    )
