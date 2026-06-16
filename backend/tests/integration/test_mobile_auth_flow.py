"""Mobile auth flow (plan §4 acceptance): the `X-Client-Type: mobile` branch delivers the
refresh token in the body (no cookie jar) and refresh/logout accept a body refresh token —
with the same rotation + reuse-detection as the cookie path, and no CSRF requirement.
"""

from __future__ import annotations

import re

import pytest

pytestmark = pytest.mark.integration

EMAIL = "mobile@example.com"
PASSWORD = "correct horse battery staple"
MOBILE = {"X-Client-Type": "mobile"}


def test_mobile_login_returns_body_refresh_no_cookie(client, mailbox) -> None:
    client.post(
        "/api/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "display_name": "Mo"},
        headers=MOBILE,
    )
    token = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[0].text_body).group(1)
    assert client.post("/api/auth/activate", json={"token": token}).status_code == 200

    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers=MOBILE,
    )
    assert login.status_code == 200
    # Refresh token in the body, NOT in a cookie.
    assert login.json["refresh_token"]
    assert not login.headers.getlist("Set-Cookie")

    access = login.json["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert me.status_code == 200
    assert me.json["email"] == EMAIL


def test_mobile_refresh_rotates_and_detects_reuse(app, client, mailbox) -> None:
    client.post(
        "/api/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "display_name": "Mo"},
        headers=MOBILE,
    )
    token = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[0].text_body).group(1)
    client.post("/api/auth/activate", json={"token": token})
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers=MOBILE,
    )
    old_refresh = login.json["refresh_token"]

    # Body refresh rotates — no CSRF header needed.
    rotated = client.post(
        "/api/auth/refresh",
        json={"refresh_token": old_refresh},
        headers=MOBILE,
    )
    assert rotated.status_code == 200
    new_refresh = rotated.json["refresh_token"]
    assert new_refresh and new_refresh != old_refresh
    assert not rotated.headers.getlist("Set-Cookie")

    # Replaying the consumed token → 401 and the whole family is revoked.
    replay = app.test_client()
    r1 = replay.post("/api/auth/refresh", json={"refresh_token": old_refresh}, headers=MOBILE)
    assert r1.status_code == 401

    after = app.test_client()
    r2 = after.post("/api/auth/refresh", json={"refresh_token": new_refresh}, headers=MOBILE)
    assert r2.status_code == 401  # rotated token dead too — family revoked


def test_mobile_logout_revokes_body_token(app, client, mailbox) -> None:
    client.post(
        "/api/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "display_name": "Mo"},
        headers=MOBILE,
    )
    token = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[0].text_body).group(1)
    client.post("/api/auth/activate", json={"token": token})
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers=MOBILE,
    )
    refresh = login.json["refresh_token"]

    out = client.post("/api/auth/logout", json={"refresh_token": refresh}, headers=MOBILE)
    assert out.status_code == 204

    # The revoked token can no longer refresh.
    dead = app.test_client()
    assert dead.post(
        "/api/auth/refresh", json={"refresh_token": refresh}, headers=MOBILE
    ).status_code == 401
