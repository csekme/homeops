"""Local-disk storage adapter (feature plan §Avatar).

Writes blobs under a configured root directory. Content type is derived from the key's
extension on load (the service chooses keys with a real extension, e.g. ``…/uuid.webp``),
so no sidecar metadata is needed.
"""

from __future__ import annotations

import mimetypes
from pathlib import Path

from app.storage.base import StorageObject

_DEFAULT_CONTENT_TYPE = "application/octet-stream"


class LocalDiskStorage:
    """Persist objects as files under ``root``; keys are relative paths."""

    def __init__(self, root: str | Path) -> None:
        self._root = Path(root).resolve()

    def _path_for(self, key: str) -> Path:
        # Resolve and confine to root — a key must never escape the storage dir.
        candidate = (self._root / key).resolve()
        if not candidate.is_relative_to(self._root):
            raise ValueError(f"storage key escapes root: {key!r}")
        return candidate

    def save(self, key: str, data: bytes, content_type: str) -> None:
        # content_type isn't persisted — it's re-derived from the key's extension on load.
        path = self._path_for(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def load(self, key: str) -> StorageObject | None:
        path = self._path_for(key)
        if not path.is_file():
            return None
        content_type = mimetypes.guess_type(path.name)[0] or _DEFAULT_CONTENT_TYPE
        return StorageObject(data=path.read_bytes(), content_type=content_type)

    def delete(self, key: str) -> None:
        self._path_for(key).unlink(missing_ok=True)

    def exists(self, key: str) -> bool:
        return self._path_for(key).is_file()
