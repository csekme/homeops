"""Unit tests for the local storage adapter + the pure avatar-URL helper (no DB/app needed)."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

from app.services.avatar_service import avatar_url
from app.storage import LocalDiskStorage


def test_local_storage_roundtrip(tmp_path) -> None:
    store = LocalDiskStorage(root=tmp_path)
    store.save("avatars/abc.webp", b"hello", "image/webp")

    assert store.exists("avatars/abc.webp")
    obj = store.load("avatars/abc.webp")
    assert obj is not None
    assert obj.data == b"hello"
    assert obj.content_type == "image/webp"  # derived from the .webp extension


def test_local_storage_missing_key_returns_none(tmp_path) -> None:
    store = LocalDiskStorage(root=tmp_path)
    assert store.load("nope.webp") is None
    assert store.exists("nope.webp") is False
    store.delete("nope.webp")  # idempotent — no error


def test_local_storage_delete_removes_object(tmp_path) -> None:
    store = LocalDiskStorage(root=tmp_path)
    store.save("a.webp", b"x", "image/webp")
    store.delete("a.webp")
    assert store.exists("a.webp") is False


def test_local_storage_rejects_path_traversal(tmp_path) -> None:
    store = LocalDiskStorage(root=tmp_path)
    with pytest.raises(ValueError, match="escapes root"):
        store.save("../../etc/passwd", b"x", "text/plain")


def test_avatar_url_none_when_no_timestamp() -> None:
    assert avatar_url(uuid.uuid4(), None) is None


def test_avatar_url_is_cache_busted_relative_path() -> None:
    uid = uuid.uuid4()
    ts = datetime(2026, 6, 29, 12, 0, 0, tzinfo=UTC)
    url = avatar_url(uid, ts)
    assert url == f"/api/users/{uid}/avatar?v={int(ts.timestamp())}"
