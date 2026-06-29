"""Device/session data access (feature plan §Device registration + remember me).

Always used in no-tenant mode (the table is user-scoped, like ``refresh_tokens``). RLS does
not apply, so every lookup that returns a single user's device filters by ``user_id``
explicitly as the compensating control. Token *secrets* never reach this layer — only their
SHA-256 hashes (``device_id_hash`` / ``trust_token_hash``).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.models import Device


def get_by_device_hash(session: Session, device_id_hash: str) -> Device | None:
    """Resolve a device by its stable identity hash (login recognition)."""
    return session.execute(
        select(Device).where(Device.device_id_hash == device_id_hash)
    ).scalar_one_or_none()


def get_by_id(session: Session, device_id: uuid.UUID | str) -> Device | None:
    """Load a device by primary key (used during refresh to read its TTL policy)."""
    return session.execute(
        select(Device).where(Device.id == uuid.UUID(str(device_id)))
    ).scalar_one_or_none()


def get_for_user(
    session: Session, *, user_id: uuid.UUID | str, device_id: uuid.UUID | str
) -> Device | None:
    """Load a device scoped to its owner — returns None for another user's id (→ 404)."""
    return session.execute(
        select(Device).where(
            Device.id == uuid.UUID(str(device_id)),
            Device.user_id == uuid.UUID(str(user_id)),
        )
    ).scalar_one_or_none()


def list_for_user(session: Session, user_id: uuid.UUID | str) -> list[Device]:
    """Live (non-revoked) devices for the session list, most-recently-seen first."""
    return list(
        session.execute(
            select(Device)
            .where(
                Device.user_id == uuid.UUID(str(user_id)),
                Device.revoked_at.is_(None),
            )
            .order_by(Device.last_seen_at.desc())
        ).scalars()
    )


def create(
    session: Session,
    *,
    user_id: uuid.UUID | str,
    device_id_hash: str,
    name: str,
    platform: str,
    user_agent: str | None,
    last_ip: str | None,
    refresh_ttl_days: int,
    remember: bool,
) -> Device:
    device = Device(
        user_id=uuid.UUID(str(user_id)),
        device_id_hash=device_id_hash,
        name=name,
        platform=platform,
        user_agent=(user_agent or "")[:400] or None,
        last_ip=last_ip,
        refresh_ttl_days=refresh_ttl_days,
        remember=remember,
        last_seen_at=datetime.now(UTC),
    )
    session.add(device)
    session.flush()
    return device


def revoke(session: Session, device: Device) -> None:
    """Mark a device revoked and drop its trust (per-device sign-out)."""
    now = datetime.now(UTC)
    device.revoked_at = now
    device.trust_token_hash = None
    device.trusted_until = None


def revoke_all_trust_for_user(session: Session, user_id: uuid.UUID | str) -> None:
    """Clear 2FA-bypass trust on every device (password reset / 2FA disable).

    A password reset or 2FA change implies possible compromise: a surviving trust window
    would let an attacker keep skipping the second factor, so we wipe it everywhere.
    """
    session.execute(
        update(Device)
        .where(Device.user_id == uuid.UUID(str(user_id)), Device.revoked_at.is_(None))
        .values(trust_token_hash=None, trusted_until=None)
    )
