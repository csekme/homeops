"""Invitation data access (plan §4.3). Hash-only token storage, single-use."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.db.models import Invitation


def create(
    session: Session,
    *,
    household_id: uuid.UUID | str,
    email: str,
    role_id: uuid.UUID | str,
    token_hash: str,
    expires_at: datetime,
    created_by_membership_id: uuid.UUID | str | None,
) -> Invitation:
    invitation = Invitation(
        household_id=uuid.UUID(str(household_id)),
        email=email,
        role_id=uuid.UUID(str(role_id)),
        token_hash=token_hash,
        expires_at=expires_at,
        created_by_membership_id=(
            uuid.UUID(str(created_by_membership_id)) if created_by_membership_id else None
        ),
    )
    session.add(invitation)
    session.flush()
    return invitation


def get_by_token_hash(session: Session, token_hash: str) -> Invitation | None:
    return session.execute(
        select(Invitation)
        .options(joinedload(Invitation.role))
        .where(Invitation.token_hash == token_hash)
    ).scalar_one_or_none()


def mark_accepted(session: Session, invitation: Invitation, *, when: datetime) -> None:
    invitation.accepted_at = when
