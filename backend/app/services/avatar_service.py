"""Avatar (profile picture) service (feature plan §Avatar).

The client crops to a circle and uploads a square image; this layer is the trust boundary:
it caps the byte size, verifies the bytes really decode as an image, then **re-encodes** to
a canonical square WEBP (honouring EXIF orientation, then stripping all metadata) before
handing it to the storage adapter. The DB keeps only the storage key + an updated-at stamp;
``avatar_updated_at`` doubles as the public URL's cache-buster.

User-scoped, so every unit of work runs in no-tenant mode (``bypass_tenant=True``) — the
``users`` table is not under RLS (mirrors ``auth_service``).
"""

from __future__ import annotations

import io
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from flask import current_app
from PIL import Image, ImageOps, UnidentifiedImageError

from app.db.rls import session_scope
from app.extensions import get_avatar_storage
from app.logging_config import get_logger
from app.repositories import users as user_repo
from app.services.exceptions import InvalidAvatarImage
from app.storage import StorageObject

log = get_logger("homeops.avatar")

_CONTENT_TYPE = "image/webp"


@dataclass(frozen=True)
class AvatarView:
    """The avatar-relevant projection of a user (for building ``UserOut.avatar_url``)."""

    user_id: str
    avatar_updated_at: datetime | None

    @property
    def avatar_url(self) -> str | None:
        return avatar_url(self.user_id, self.avatar_updated_at)


def avatar_url(user_id: uuid.UUID | str, avatar_updated_at: datetime | None) -> str | None:
    """The public, cache-busted path to a user's avatar, or ``None`` if they have none.

    Relative on purpose: the web consumes it same-origin via the proxy; mobile prefixes its
    API origin. ``?v=`` (the updated-at epoch) makes every change a fresh URL for caches.
    """
    if avatar_updated_at is None:
        return None
    version = int(avatar_updated_at.timestamp())
    return f"/api/users/{user_id}/avatar?v={version}"


def _storage_key(user_id: uuid.UUID | str) -> str:
    # One key per user — re-upload overwrites; ``?v=`` handles cache invalidation, so there
    # are never orphaned objects to garbage-collect.
    return f"avatars/{user_id}.webp"


def _process(raw: bytes) -> bytes:
    """Validate + re-encode the upload to a canonical square WEBP, dropping all metadata."""
    cfg = current_app.config
    if not raw:
        raise InvalidAvatarImage("empty upload")
    if len(raw) > cfg["AVATAR_MAX_UPLOAD_BYTES"]:
        raise InvalidAvatarImage("image too large", too_large=True)

    try:
        with Image.open(io.BytesIO(raw)) as opened:
            # Honour camera orientation, then flatten to RGB (drops alpha + EXIF).
            oriented = ImageOps.exif_transpose(opened)
            rgb = oriented.convert("RGB")
            # Defensive centre-crop to square (the client already sends square) + downscale.
            size = cfg["AVATAR_OUTPUT_SIZE"]
            square = ImageOps.fit(rgb, (size, size), method=Image.Resampling.LANCZOS)
            out = io.BytesIO()
            square.save(out, format="WEBP", quality=85, method=6)
            return out.getvalue()
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise InvalidAvatarImage("file is not a valid image") from exc


def set_avatar(*, user_id: uuid.UUID | str, raw: bytes) -> AvatarView:
    """Process + store the upload and stamp the user; returns the new avatar projection.

    The incoming content type is intentionally ignored — the bytes are validated and
    re-encoded to a canonical WEBP regardless of what the client claims.
    """
    processed = _process(raw)
    key = _storage_key(user_id)
    get_avatar_storage().save(key, processed, _CONTENT_TYPE)

    now = datetime.now(UTC)
    with session_scope(bypass_tenant=True) as session:
        user = user_repo.get_by_id(session, user_id)
        if user is None:  # pragma: no cover — caller is the authenticated user
            raise InvalidAvatarImage("user not found")
        user.avatar_key = key
        user.avatar_updated_at = now
    log.info("avatar.set", user_id=str(user_id))
    return AvatarView(user_id=str(user_id), avatar_updated_at=now)


def remove_avatar(*, user_id: uuid.UUID | str) -> None:
    """Delete the stored object (if any) and clear the user's avatar columns."""
    with session_scope(bypass_tenant=True) as session:
        user = user_repo.get_by_id(session, user_id)
        if user is None:  # pragma: no cover
            return
        key = user.avatar_key
        user.avatar_key = None
        user.avatar_updated_at = None
    if key:
        get_avatar_storage().delete(key)
    log.info("avatar.removed", user_id=str(user_id))


def load_avatar(*, user_id: uuid.UUID | str) -> StorageObject | None:
    """Fetch the stored avatar bytes for serving, or ``None`` if the user has none."""
    with session_scope(bypass_tenant=True) as session:
        user = user_repo.get_by_id(session, user_id)
        if user is None or user.avatar_key is None:
            return None
        key = user.avatar_key
    return get_avatar_storage().load(key)
