"""Storage adapter contract (feature plan §Avatar)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, runtime_checkable


@dataclass(frozen=True)
class StorageObject:
    """A stored blob plus the content type it was saved with."""

    data: bytes
    content_type: str


@runtime_checkable
class StorageAdapter(Protocol):
    """Where binary objects (avatars, …) live, keyed by an opaque string key.

    Implementations are responsible only for byte persistence — no image processing,
    no DB. Keys are caller-chosen and treated as opaque paths.
    """

    def save(self, key: str, data: bytes, content_type: str) -> None: ...

    def load(self, key: str) -> StorageObject | None:
        """Return the stored object, or ``None`` if the key is absent."""
        ...

    def delete(self, key: str) -> None:
        """Remove the key. Missing keys are a no-op (idempotent)."""
        ...

    def exists(self, key: str) -> bool: ...
