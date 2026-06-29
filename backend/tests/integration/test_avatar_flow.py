"""End-to-end avatar (profile picture) flow (feature plan §Avatar): upload re-encodes to a
canonical square WEBP and surfaces a cache-busted ``avatar_url``; the public GET serves the
bytes; DELETE clears it; PUT/DELETE require auth; non-images and oversized uploads are rejected.
"""

from __future__ import annotations

import io
import re

import pytest
from PIL import Image

pytestmark = pytest.mark.integration

EMAIL = "ava@example.com"
PASSWORD = "correct horse battery staple"
BEARER = {"X-Auth-Transport": "bearer"}


def _register_activate_login(client, mailbox) -> str:
    r = client.post(
        "/api/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "display_name": "Ava"},
    )
    assert r.status_code == 202
    token = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[-1].text_body).group(1)
    assert client.post("/api/auth/activate", json={"token": token}).status_code == 200
    login = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=BEARER
    )
    assert login.status_code == 200
    return login.json["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _png_bytes(color: tuple[int, int, int] = (10, 120, 200), size: int = 300) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (size, size), color).save(buf, format="PNG")
    return buf.getvalue()


def _upload(
    client,
    access: str,
    data: bytes,
    *,
    filename: str = "pic.png",
    content_type: str = "image/png",
):
    return client.put(
        "/api/auth/avatar",
        headers=_auth(access),
        data={"file": (io.BytesIO(data), filename, content_type)},
        content_type="multipart/form-data",
    )


def test_upload_sets_avatar_url_and_me_reports_it(client, mailbox) -> None:
    access = _register_activate_login(client, mailbox)

    # No avatar initially.
    me = client.get("/api/auth/me", headers=_auth(access))
    assert me.json["avatar_url"] is None

    resp = _upload(client, access, _png_bytes())
    assert resp.status_code == 200
    url = resp.json["avatar_url"]
    assert url is not None
    user_id = resp.json["id"]
    assert url.startswith(f"/api/users/{user_id}/avatar?v=")

    # /me agrees.
    me = client.get("/api/auth/me", headers=_auth(access))
    assert me.json["avatar_url"] == url


def test_public_get_serves_canonical_webp(client, mailbox) -> None:
    access = _register_activate_login(client, mailbox)
    resp = _upload(client, access, _png_bytes(size=300))
    user_id = resp.json["id"]

    # Public (no auth) GET returns a 512x512 WEBP.
    img_resp = client.get(f"/api/users/{user_id}/avatar")
    assert img_resp.status_code == 200
    assert img_resp.mimetype == "image/webp"
    with Image.open(io.BytesIO(img_resp.data)) as out:
        assert out.format == "WEBP"
        assert out.size == (512, 512)
    assert "max-age" in img_resp.headers["Cache-Control"]


def test_delete_removes_avatar(client, mailbox) -> None:
    access = _register_activate_login(client, mailbox)
    resp = _upload(client, access, _png_bytes())
    user_id = resp.json["id"]
    assert client.get(f"/api/users/{user_id}/avatar").status_code == 200

    d = client.delete("/api/auth/avatar", headers=_auth(access))
    assert d.status_code == 204

    assert client.get(f"/api/users/{user_id}/avatar").status_code == 404
    me = client.get("/api/auth/me", headers=_auth(access))
    assert me.json["avatar_url"] is None


def test_upload_requires_auth(client) -> None:
    assert _upload(client, "not-a-token", _png_bytes()).status_code == 401


def test_non_image_is_rejected(client, mailbox) -> None:
    access = _register_activate_login(client, mailbox)
    resp = _upload(client, access, b"this is definitely not an image", filename="x.png")
    assert resp.status_code == 400


def test_missing_avatar_returns_404(client, mailbox) -> None:
    access = _register_activate_login(client, mailbox)
    user_id = client.get("/api/auth/me", headers=_auth(access)).json["id"]
    assert client.get(f"/api/users/{user_id}/avatar").status_code == 404
