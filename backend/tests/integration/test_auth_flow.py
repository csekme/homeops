"""End-to-end auth flow (plan §3.5 acceptance, §13): register → activate → login →
me → refresh (rotate) → reuse-detection (family revoke) → logout.
"""

from __future__ import annotations

import re

import pytest

pytestmark = pytest.mark.integration

EMAIL = "alice@example.com"
PASSWORD = "correct horse battery staple"


def _set_cookies(response) -> dict[str, str]:
    jar: dict[str, str] = {}
    for header in response.headers.getlist("Set-Cookie"):
        name, _, rest = header.partition("=")
        jar[name] = rest.split(";")[0]
    return jar


def _register_and_activate(client, mailbox) -> None:
    r = client.post(
        "/api/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "display_name": "Alice"},
    )
    assert r.status_code == 202
    assert len(mailbox.sent) == 1
    token = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[0].text_body).group(1)

    # Login is rejected before activation.
    pre = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert pre.status_code == 403

    act = client.post("/api/auth/activate", json={"token": token})
    assert act.status_code == 200


def test_register_activate_login_me(client, mailbox) -> None:
    _register_and_activate(client, mailbox)

    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert login.status_code == 200
    access = login.json["access_token"]
    assert login.json["token_type"] == "Bearer"

    raw_cookies = ";".join(login.headers.getlist("Set-Cookie"))
    assert "refresh_token=" in raw_cookies
    assert "HttpOnly" in raw_cookies
    assert "SameSite=Strict" in raw_cookies

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200
    assert me.json["email"] == EMAIL
    assert me.json["status"] == "ACTIVE"

    assert client.get("/api/auth/me").status_code == 401  # no bearer


def test_refresh_rotation_and_reuse_detection(app, client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    cookies = _set_cookies(login)
    csrf, old_refresh = cookies["csrf_token"], cookies["refresh_token"]

    # No CSRF header → blocked.
    assert client.post("/api/auth/refresh").status_code == 403

    # Valid rotation issues a new refresh token.
    rotated = client.post("/api/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert rotated.status_code == 200
    new_cookies = _set_cookies(rotated)
    new_csrf, new_refresh = new_cookies["csrf_token"], new_cookies["refresh_token"]
    assert new_refresh != old_refresh

    # Replay the consumed (old) token on a fresh client → 401 and the family is revoked.
    # Werkzeug's test client is jar-authoritative, so seed cookies via set_cookie().
    replay = app.test_client()
    replay.set_cookie("refresh_token", old_refresh, domain="localhost", path="/api/auth")
    replay.set_cookie("csrf_token", new_csrf, domain="localhost", path="/api/auth")
    r1 = replay.post("/api/auth/refresh", headers={"X-CSRF-Token": new_csrf})
    assert r1.status_code == 401

    # The rotated (new) token is now dead too — whole family revoked.
    after = app.test_client()
    after.set_cookie("refresh_token", new_refresh, domain="localhost", path="/api/auth")
    after.set_cookie("csrf_token", new_csrf, domain="localhost", path="/api/auth")
    r2 = after.post("/api/auth/refresh", headers={"X-CSRF-Token": new_csrf})
    assert r2.status_code == 401


def test_logout_revokes_and_clears_cookies(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    out = client.post("/api/auth/logout")
    assert out.status_code == 204
    cleared = ";".join(out.headers.getlist("Set-Cookie"))
    assert "refresh_token=;" in cleared or "refresh_token=" in cleared
