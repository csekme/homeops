"""Binary object storage (feature plan §Avatar).

A thin ``StorageAdapter`` seam so the service layer never knows *where* bytes live. Today
the only implementation is ``LocalDiskStorage`` (served through the nginx proxy); an
S3/MinIO adapter can drop in behind the same interface without touching callers.
"""

from __future__ import annotations

from app.storage.base import StorageAdapter, StorageObject
from app.storage.local import LocalDiskStorage


def build_storage(config: object) -> StorageAdapter:
    """Construct the configured storage adapter from app config.

    Only ``local`` exists for now; the indirection is the extension point for S3/MinIO.
    """
    return LocalDiskStorage(root=config["AVATAR_LOCAL_DIR"])  # type: ignore[index]


__all__ = ["LocalDiskStorage", "StorageAdapter", "StorageObject", "build_storage"]
