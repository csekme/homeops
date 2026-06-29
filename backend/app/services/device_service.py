"""Device/session management (feature plan §Device registration).

The settings "Security → Devices" surface: list the user's live sessions, rename them, and
sign out individual or all-other devices. All access runs in no-tenant mode (the table is
user-scoped) with an explicit ``user_id`` filter as the compensating control; an id that
isn't the caller's resolves to ``DeviceNotFound`` (→ 404, no existence leak).
"""

from __future__ import annotations

import hashlib
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from app.db.models import Device
from app.db.rls import session_scope
from app.logging_config import get_logger
from app.repositories import devices as devices_repo
from app.security import refresh_tokens
from app.services.exceptions import DeviceNotFound

log = get_logger("homeops.devices")


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


@dataclass(frozen=True)
class DeviceView:
    id: str
    name: str
    platform: str
    last_ip: str | None
    last_seen_at: str
    created_at: str
    trusted: bool
    current: bool


def _is_trusted_now(device: Device) -> bool:
    return (
        device.trust_token_hash is not None
        and device.trusted_until is not None
        and _as_utc(device.trusted_until) > datetime.now(UTC)
    )


def _to_view(device: Device, current_hash: str | None) -> DeviceView:
    return DeviceView(
        id=str(device.id),
        name=device.name,
        platform=device.platform,
        last_ip=device.last_ip,
        last_seen_at=_as_utc(device.last_seen_at).isoformat(),
        created_at=_as_utc(device.created_at).isoformat(),
        trusted=_is_trusted_now(device),
        current=current_hash is not None and device.device_id_hash == current_hash,
    )


def list_devices(
    *, user_id: uuid.UUID | str, current_device_id_token: str | None
) -> list[DeviceView]:
    current_hash = _hash(current_device_id_token) if current_device_id_token else None
    with session_scope(bypass_tenant=True) as session:
        devices = devices_repo.list_for_user(session, user_id)
        return [_to_view(d, current_hash) for d in devices]


def rename_device(*, user_id: uuid.UUID | str, device_id: str, name: str) -> None:
    with session_scope(bypass_tenant=True) as session:
        device = devices_repo.get_for_user(session, user_id=user_id, device_id=device_id)
        if device is None or device.revoked_at is not None:
            raise DeviceNotFound("device not found")
        device.name = name.strip()[:80]
        log.info("device.renamed", device_id=str(device.id), user_id=str(user_id))


def revoke_device(
    *, user_id: uuid.UUID | str, device_id: str, current_device_id_token: str | None
) -> bool:
    """Revoke one device (sign it out). Returns whether it was the *current* device, so the
    controller can also clear the caller's own cookies."""
    current_hash = _hash(current_device_id_token) if current_device_id_token else None
    with session_scope(bypass_tenant=True) as session:
        device = devices_repo.get_for_user(session, user_id=user_id, device_id=device_id)
        if device is None or device.revoked_at is not None:
            raise DeviceNotFound("device not found")
        is_current = current_hash is not None and device.device_id_hash == current_hash
        refresh_tokens.revoke_for_device(session, device.id)
        devices_repo.revoke(session, device)
        log.info("device.revoked", device_id=str(device.id), user_id=str(user_id))
        return is_current


def revoke_other_devices(
    *, user_id: uuid.UUID | str, current_device_id_token: str | None
) -> int:
    """Sign out every device except the current one. Returns how many were revoked."""
    current_hash = _hash(current_device_id_token) if current_device_id_token else None
    with session_scope(bypass_tenant=True) as session:
        revoked = 0
        for device in devices_repo.list_for_user(session, user_id):
            if current_hash is not None and device.device_id_hash == current_hash:
                continue
            refresh_tokens.revoke_for_device(session, device.id)
            devices_repo.revoke(session, device)
            revoked += 1
        log.info("device.revoked_others", user_id=str(user_id), count=revoked)
        return revoked
