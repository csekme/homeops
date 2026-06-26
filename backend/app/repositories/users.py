"""User + membership data access (plan §3.5, §3.6)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models import Household, Membership, User


def get_by_email(session: Session, email: str) -> User | None:
    return session.execute(
        select(User).where(User.email == email.strip().lower())
    ).scalar_one_or_none()


def get_by_id(session: Session, user_id: uuid.UUID | str) -> User | None:
    return session.get(User, uuid.UUID(str(user_id)))


def add(session: Session, user: User) -> User:
    session.add(user)
    session.flush()
    return user


def list_memberships(session: Session, user_id: uuid.UUID | str) -> list[Membership]:
    """A user's memberships in *live* households (cross-household — no-tenant mode, plan §3.6).

    Soft-deleted (archived) households are excluded: RLS doesn't filter on ``deleted_at``, so
    the join + ``deleted_at IS NULL`` is what keeps archived households out of ``/me`` and out
    of the active-household selection (login/refresh).
    """
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
