"""Invitation data access (feature plan §Backend). Hash-only token storage.

Create / list / revoke run in the inviter's tenant scope (RLS keys on ``household_id``).
``get_by_token_hash`` is used by the acceptance path, which runs in no-tenant mode — the
email-binding check in ``invitation_service.accept`` is the compensating control there.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

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
    invited_by: uuid.UUID | str | None,
) -> Invitation:
    invitation = Invitation(
        household_id=uuid.UUID(str(household_id)),
        email=email.strip().lower(),
        role_id=uuid.UUID(str(role_id)),
        token_hash=token_hash,
        expires_at=expires_at,
        invited_by=uuid.UUID(str(invited_by)) if invited_by is not None else None,
    )
    session.add(invitation)
    session.flush()
    return invitation


def get_by_id(session: Session, invitation_id: uuid.UUID | str) -> Invitation | None:
    return session.get(Invitation, uuid.UUID(str(invitation_id)))


def get_by_token_hash(session: Session, token_hash: str) -> Invitation | None:
    """Resolve an invitation by token hash, eager-loading household + role for previews.
    Used by the no-tenant acceptance/preview path."""
    return session.execute(
        select(Invitation)
        .options(joinedload(Invitation.household), joinedload(Invitation.role))
        .where(Invitation.token_hash == token_hash)
    ).scalar_one_or_none()


def find_pending_for_email(
    session: Session, *, household_id: uuid.UUID | str, email: str
) -> Invitation | None:
    return session.execute(
        select(Invitation).where(
            Invitation.household_id == uuid.UUID(str(household_id)),
            Invitation.email == email.strip().lower(),
            Invitation.accepted_at.is_(None),
            Invitation.revoked_at.is_(None),
        )
    ).scalar_one_or_none()


def list_pending(session: Session, household_id: uuid.UUID | str) -> list[Invitation]:
    return list(
        session.execute(
            select(Invitation)
            .options(joinedload(Invitation.role))
            .where(
                Invitation.household_id == uuid.UUID(str(household_id)),
                Invitation.accepted_at.is_(None),
                Invitation.revoked_at.is_(None),
            )
            .order_by(Invitation.created_at.desc())
        )
        .scalars()
        .all()
    )


def mark_accepted(session: Session, invitation: Invitation) -> Invitation:
    invitation.accepted_at = datetime.now(UTC)
    session.flush()
    return invitation


def revoke(session: Session, invitation: Invitation) -> Invitation:
    invitation.revoked_at = datetime.now(UTC)
    session.flush()
    return invitation


def set_token(
    session: Session, invitation: Invitation, *, token_hash: str, expires_at: datetime
) -> Invitation:
    """Re-issue the token on a pending invitation (resend) — invalidates the old token."""
    invitation.token_hash = token_hash
    invitation.expires_at = expires_at
    session.flush()
    return invitation
