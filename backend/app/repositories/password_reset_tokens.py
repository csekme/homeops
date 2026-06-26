"""Password-reset token data access (feature plan §#1). Hash-only token storage.

Always used in no-tenant mode (the table is user-scoped, like ``activation_tokens``). The
single-use guarantee comes from ``used_at``; expiry from ``expires_at``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import PasswordResetToken


def create(
    session: Session,
    *,
    user_id: uuid.UUID | str,
    token_hash: str,
    expires_at: datetime,
) -> PasswordResetToken:
    token = PasswordResetToken(
        user_id=uuid.UUID(str(user_id)),
        token_hash=token_hash,
        expires_at=expires_at,
    )
    session.add(token)
    session.flush()
    return token


def get_by_token_hash(session: Session, token_hash: str) -> PasswordResetToken | None:
    return session.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    ).scalar_one_or_none()
