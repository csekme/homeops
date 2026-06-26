"""Refresh-token issue / rotate / revoke + reuse-detection (plan §3.5c/§3.5d, §14).

The opaque token (≥256 bits of randomness) is returned to the client; only its SHA-256
hash is persisted. On every refresh a new token is minted within the same ``family_id``
and the consumed one is marked ``used``. Replaying an already-used or revoked token is
treated as theft: the **entire family is revoked**, and the caller raises 401 + audits.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.models import RefreshToken

_TOKEN_BYTES = 32  # 256 bits


class InvalidRefreshToken(Exception):
    """The presented refresh token does not match any stored hash."""


class RefreshTokenReuse(Exception):
    """A used/revoked token was replayed → the family has been revoked."""

    def __init__(self, family_id: uuid.UUID, user_id: uuid.UUID) -> None:
        super().__init__("refresh token reuse detected")
        self.family_id = family_id
        self.user_id = user_id


@dataclass(frozen=True)
class IssuedRefreshToken:
    raw_token: str
    record: RefreshToken


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _new_raw_token() -> str:
    return secrets.token_urlsafe(_TOKEN_BYTES)


def issue(
    session: Session,
    *,
    user_id: uuid.UUID,
    ttl_days: int,
    ip: str | None = None,
    user_agent: str | None = None,
    family_id: uuid.UUID | None = None,
    prev_id: uuid.UUID | None = None,
    household_id: uuid.UUID | str | None = None,
) -> IssuedRefreshToken:
    raw = _new_raw_token()
    record = RefreshToken(
        user_id=user_id,
        # The active household rides along so refresh() re-mints into the same tenant the
        # user switched to (feature plan §Backend). Rotation carries it forward.
        household_id=uuid.UUID(str(household_id)) if household_id is not None else None,
        family_id=family_id or uuid.uuid4(),
        prev_id=prev_id,
        token_hash=hash_token(raw),
        expires_at=datetime.now(UTC) + timedelta(days=ttl_days),
        ip=ip,
        user_agent=(user_agent or "")[:400] or None,
    )
    session.add(record)
    session.flush()
    return IssuedRefreshToken(raw_token=raw, record=record)


def revoke_family(session: Session, family_id: uuid.UUID) -> None:
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def revoke_all_for_user(session: Session, user_id: uuid.UUID | str) -> None:
    """Revoke every live refresh family for a user (password reset, plan §#1).

    Invalidating all sessions on a password change is established practice: a stolen or
    forgotten session must not survive the reset.
    """
    session.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == uuid.UUID(str(user_id)),
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )


def rotate(
    session: Session,
    *,
    raw_token: str,
    ttl_days: int,
    ip: str | None = None,
    user_agent: str | None = None,
) -> IssuedRefreshToken:
    """Validate + consume the presented token, returning a freshly issued successor.

    Raises ``RefreshTokenReuse`` (after revoking the whole family) on replay, or
    ``InvalidRefreshToken`` if the token is unknown / expired.
    """
    record = session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))
    ).scalar_one_or_none()

    if record is None:
        raise InvalidRefreshToken("unknown token")

    now = datetime.now(UTC)

    # Reuse / theft: a token that was already consumed or revoked is being replayed.
    # We only *detect* here and raise with the family id — the caller revokes the family
    # in its own committed transaction (revoking on this session would be rolled back
    # together with the exception we are about to raise).
    if record.used_at is not None or record.revoked_at is not None:
        raise RefreshTokenReuse(family_id=record.family_id, user_id=record.user_id)

    if _as_utc(record.expires_at) <= now:
        raise InvalidRefreshToken("expired token")

    record.used_at = now
    session.flush()

    return issue(
        session,
        user_id=record.user_id,
        ttl_days=ttl_days,
        ip=ip,
        user_agent=user_agent,
        family_id=record.family_id,
        prev_id=record.id,
        household_id=record.household_id,
    )


def set_active_household(
    session: Session, *, user_id: uuid.UUID | str, household_id: uuid.UUID | str | None
) -> None:
    """Point the user's live refresh sessions at ``household_id`` so the next refresh
    re-mints the access token into the switched household (feature plan §Backend).

    The switch endpoint is authenticated by the *access* token and never receives the raw
    refresh token (the web refresh cookie is path-scoped to ``/api/auth``), so we identify
    the sessions by ``user_id`` instead. Caveat: a user signed in on multiple devices shares
    one active household — a switch on one device follows to the others on their next refresh.
    """
    session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == uuid.UUID(str(user_id)), RefreshToken.revoked_at.is_(None))
        .values(household_id=uuid.UUID(str(household_id)) if household_id is not None else None)
    )


def revoke(session: Session, *, raw_token: str) -> uuid.UUID | None:
    """Revoke the family the token belongs to (logout). Returns the user id if found."""
    record = session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))
    ).scalar_one_or_none()
    if record is None:
        return None
    revoke_family(session, record.family_id)
    return record.user_id


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
