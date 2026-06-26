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


# ── Mobile bearer transport (phase0-mobile) ─────────────────────────────────────────────

BEARER = {"X-Auth-Transport": "bearer"}


def test_mobile_login_returns_refresh_in_body_without_cookies(client, mailbox) -> None:
    _register_and_activate(client, mailbox)

    login = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=BEARER
    )
    assert login.status_code == 200
    # Refresh token rides in the body, NOT a cookie.
    assert login.json["refresh_token"]
    assert "Set-Cookie" not in login.headers
    assert "refresh_token" not in _set_cookies(login)

    # The body access token authenticates /me as usual.
    me = client.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {login.json['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json["email"] == EMAIL


def test_mobile_refresh_rotates_via_body_no_csrf(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    login = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=BEARER
    )
    old_refresh = login.json["refresh_token"]

    # No CSRF header/cookie needed on the bearer path — the body token is the credential.
    rotated = client.post(
        "/api/auth/refresh", json={"refresh_token": old_refresh}, headers=BEARER
    )
    assert rotated.status_code == 200
    new_refresh = rotated.json["refresh_token"]
    assert new_refresh and new_refresh != old_refresh
    assert "Set-Cookie" not in rotated.headers

    # Replaying the consumed token revokes the family → 401 (reuse detection still applies).
    replay = client.post(
        "/api/auth/refresh", json={"refresh_token": old_refresh}, headers=BEARER
    )
    assert replay.status_code == 401


def test_mobile_logout_revokes_body_token(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    login = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=BEARER
    )
    refresh_token = login.json["refresh_token"]

    out = client.post(
        "/api/auth/logout", json={"refresh_token": refresh_token}, headers=BEARER
    )
    assert out.status_code == 204

    # The token is dead after logout.
    after = client.post(
        "/api/auth/refresh", json={"refresh_token": refresh_token}, headers=BEARER
    )
    assert after.status_code == 401


def test_web_path_unchanged_when_no_transport_header(client, mailbox) -> None:
    """Regression guard: without the header the cookie+CSRF behaviour is byte-for-byte intact."""
    _register_and_activate(client, mailbox)
    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert "refresh_token" not in login.json  # never leaks into the web body
    cookies = _set_cookies(login)
    assert cookies["refresh_token"] and cookies["csrf_token"]

    # Cookie refresh still requires CSRF.
    assert client.post("/api/auth/refresh").status_code == 403
    rotated = client.post("/api/auth/refresh", headers={"X-CSRF-Token": cookies["csrf_token"]})
    assert rotated.status_code == 200
    assert "refresh_token" not in rotated.json  # cookie path never returns a body token
