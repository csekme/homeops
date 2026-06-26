"""End-to-end password reset (feature plan §#1): forgot-password (generic, no enumeration)
→ reset-password (single-use token) → login with the new password, with all prior refresh
sessions revoked.
"""

from __future__ import annotations

import re

import pytest

pytestmark = pytest.mark.integration

EMAIL = "reset-me@example.com"
OLD_PASSWORD = "correct horse battery staple"
NEW_PASSWORD = "a brand new much longer secret"
BEARER = {"X-Auth-Transport": "bearer"}


def _reset_token(mailbox, email: str) -> str:
    pattern = re.compile(r"/reset-password/([A-Za-z0-9_-]+)")
    for msg in reversed(mailbox.sent):
        if msg.to == email and (m := pattern.search(msg.text_body)):
            return m.group(1)
    raise AssertionError(f"no /reset-password/ link emailed to {email}")


def _signup(client, mailbox, email: str = EMAIL) -> None:
    assert client.post(
        "/api/auth/register",
        json={"email": email, "password": OLD_PASSWORD, "display_name": "User"},
    ).status_code == 202
    token = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[-1].text_body).group(1)
    assert client.post("/api/auth/activate", json={"token": token}).status_code == 200


def test_forgot_then_reset_then_login_with_new_password(client, mailbox) -> None:
    _signup(client, mailbox)

    forgot = client.post("/api/auth/forgot-password", json={"email": EMAIL})
    assert forgot.status_code == 202
    token = _reset_token(mailbox, EMAIL)

    reset = client.post(
        "/api/auth/reset-password", json={"token": token, "password": NEW_PASSWORD}
    )
    assert reset.status_code == 200

    # Old password no longer works; the new one does.
    assert client.post(
        "/api/auth/login", json={"email": EMAIL, "password": OLD_PASSWORD}
    ).status_code == 401
    assert client.post(
        "/api/auth/login", json={"email": EMAIL, "password": NEW_PASSWORD}
    ).status_code == 200


def test_reset_token_is_single_use(client, mailbox) -> None:
    _signup(client, mailbox)
    client.post("/api/auth/forgot-password", json={"email": EMAIL})
    token = _reset_token(mailbox, EMAIL)

    assert client.post(
        "/api/auth/reset-password", json={"token": token, "password": NEW_PASSWORD}
    ).status_code == 200
    # Replaying the consumed token is rejected.
    assert client.post(
        "/api/auth/reset-password", json={"token": token, "password": "yet another secret here"}
    ).status_code == 400


def test_reset_revokes_existing_refresh_sessions(client, mailbox) -> None:
    _signup(client, mailbox)
    login = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": OLD_PASSWORD}, headers=BEARER
    )
    old_refresh = login.json["refresh_token"]

    client.post("/api/auth/forgot-password", json={"email": EMAIL})
    token = _reset_token(mailbox, EMAIL)
    assert client.post(
        "/api/auth/reset-password", json={"token": token, "password": NEW_PASSWORD}
    ).status_code == 200

    # The pre-reset refresh token is dead — live sessions don't survive a password reset.
    replay = client.post(
        "/api/auth/refresh", json={"refresh_token": old_refresh}, headers=BEARER
    )
    assert replay.status_code == 401


def test_forgot_password_is_generic_for_unknown_email(client, mailbox) -> None:
    # No account → still a 202, and no email is sent (no user enumeration).
    r = client.post("/api/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 202
    assert mailbox.sent == []


def test_forgot_password_ignores_unactivated_account(client, mailbox) -> None:
    # Registered but not activated → generic 202, but no reset email (only ACTIVE users).
    assert client.post(
        "/api/auth/register",
        json={"email": "pending@example.com", "password": OLD_PASSWORD, "display_name": "P"},
    ).status_code == 202
    mailbox.sent.clear()

    r = client.post("/api/auth/forgot-password", json={"email": "pending@example.com"})
    assert r.status_code == 202
    assert mailbox.sent == []
