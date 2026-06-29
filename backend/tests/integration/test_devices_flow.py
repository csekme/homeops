"""End-to-end device registration + "remember me" + trusted-device flow (feature plan
§Device registration). Covers: short vs long refresh TTL (incl. the rotation regression),
session-cookie vs persistent cookie, trusted-device 2FA skip and its negative cases, trust
rotation/theft, password-reset/2FA-disable trust wipe, and device management endpoints.
"""

from __future__ import annotations

import datetime
import re

import pyotp
import pytest
from sqlalchemy import text

from app.security.refresh_tokens import hash_token

pytestmark = pytest.mark.integration

EMAIL = "dora@example.com"
PASSWORD = "correct horse battery staple"
BEARER = {"X-Auth-Transport": "bearer"}


def _register_and_activate(client, mailbox) -> None:
    r = client.post(
        "/api/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "display_name": "Dora"},
    )
    assert r.status_code == 202
    token = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[-1].text_body).group(1)
    assert client.post("/api/auth/activate", json={"token": token}).status_code == 200


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _totp_code(secret: str, offset: int = 0) -> str:
    t = pyotp.TOTP(secret)
    return t.generate_otp(t.timecode(datetime.datetime.now()) + offset)


def _enroll_totp(client, access: str) -> str:
    setup = client.post("/api/auth/totp/setup", headers=_auth(access))
    secret = setup.json["secret"]
    confirm = client.post(
        "/api/auth/totp/confirm", headers=_auth(access), json={"code": _totp_code(secret)}
    )
    assert confirm.status_code == 200
    return secret


def _refresh_expires_at(engine, raw_refresh: str) -> datetime.datetime:
    with engine.begin() as conn:
        row = conn.execute(
            text("SELECT expires_at FROM refresh_tokens WHERE token_hash = :h"),
            {"h": hash_token(raw_refresh)},
        ).one()
    return row[0]


def _set_cookies(response) -> dict[str, str]:
    jar: dict[str, str] = {}
    for header in response.headers.getlist("Set-Cookie"):
        name, _, rest = header.partition("=")
        jar[name] = rest.split(";")[0]
    return jar


# ── "Remember me" TTL: short vs long, and the rotation regression ────────────────────


def test_remember_false_issues_short_refresh_and_stays_short_after_rotation(
    client, mailbox, _privileged_engine
) -> None:
    _register_and_activate(client, mailbox)
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD, "remember_me": False},
        headers=BEARER,
    )
    assert login.status_code == 200
    raw = login.json["refresh_token"]
    now = datetime.datetime.now(datetime.UTC)

    first = _refresh_expires_at(_privileged_engine, raw)
    # A non-remembered session expires in ~1 day, not 30.
    assert first - now < datetime.timedelta(days=2)

    rotated = client.post("/api/auth/refresh", json={"refresh_token": raw}, headers=BEARER)
    new_raw = rotated.json["refresh_token"]
    # Regression guard: the rotated token must NOT inflate to the long (30d) TTL.
    after = _refresh_expires_at(_privileged_engine, new_raw)
    assert after - now < datetime.timedelta(days=2)


def test_remember_true_issues_long_refresh(client, mailbox, _privileged_engine) -> None:
    _register_and_activate(client, mailbox)
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD, "remember_me": True},
        headers=BEARER,
    )
    raw = login.json["refresh_token"]
    now = datetime.datetime.now(datetime.UTC)
    assert _refresh_expires_at(_privileged_engine, raw) - now > datetime.timedelta(days=20)


def test_web_remember_cookie_is_persistent_unchecked_is_session(client, mailbox) -> None:
    _register_and_activate(client, mailbox)

    remembered = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD, "remember_me": True}
    )
    remembered_cookies = ";".join(remembered.headers.getlist("Set-Cookie"))
    assert "refresh_token=" in remembered_cookies
    assert "Max-Age=" in remembered_cookies  # persistent

    client.post("/api/auth/logout")

    ephemeral = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD, "remember_me": False}
    )
    refresh_header = next(
        h for h in ephemeral.headers.getlist("Set-Cookie") if h.startswith("refresh_token=")
    )
    assert "Max-Age=" not in refresh_header  # browser-session cookie


# ── Trusted device skips 2FA ─────────────────────────────────────────────────────────


def test_trusted_device_skips_totp_on_next_login(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    # First login (no 2FA yet) to enroll.
    access = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=BEARER
    ).json["access_token"]
    secret = _enroll_totp(client, access)

    # Second login: 2FA on, device not yet trusted → challenge.
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD, "remember_me": True, "grant_trust": True},
        headers=BEARER,
    )
    assert login.json["mfa_required"] is True
    verify = client.post(
        "/api/auth/totp/verify",
        json={"challenge_token": login.json["challenge_token"], "code": _totp_code(secret, 1)},
        headers=BEARER,
    )
    assert verify.status_code == 200
    device_id = verify.json["device_id"]
    trust = verify.json["device_trust"]
    assert device_id and trust

    # Third login presenting the device identity + trust → 2FA skipped, full session.
    trusted_login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD, "remember_me": True, "grant_trust": True},
        headers={**BEARER, "X-Device-Id": device_id, "X-Device-Trust": trust},
    )
    assert trusted_login.status_code == 200
    assert trusted_login.json.get("mfa_required") is None
    assert "access_token" in trusted_login.json


def test_untrusted_or_mismatched_device_still_requires_totp(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    access = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=BEARER
    ).json["access_token"]
    secret = _enroll_totp(client, access)
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD, "remember_me": True, "grant_trust": True},
        headers=BEARER,
    )
    verify = client.post(
        "/api/auth/totp/verify",
        json={"challenge_token": login.json["challenge_token"], "code": _totp_code(secret, 1)},
        headers=BEARER,
    )
    device_id = verify.json["device_id"]

    # Right device id but a bogus trust secret → no skip.
    bad = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers={**BEARER, "X-Device-Id": device_id, "X-Device-Trust": "not-the-secret"},
    )
    assert bad.json["mfa_required"] is True


def test_grant_trust_without_2fa_does_not_mint_trust(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD, "remember_me": True, "grant_trust": True},
        headers=BEARER,
    )
    # No 2FA configured → nothing to skip → no trust secret minted.
    assert "device_trust" not in login.json
    assert login.json["device_id"]


# ── Trust rotation + theft on refresh ────────────────────────────────────────────────


def test_trust_token_rotates_on_refresh_and_replay_clears_trust(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    access = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=BEARER
    ).json["access_token"]
    secret = _enroll_totp(client, access)
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD, "remember_me": True, "grant_trust": True},
        headers=BEARER,
    )
    verify = client.post(
        "/api/auth/totp/verify",
        json={"challenge_token": login.json["challenge_token"], "code": _totp_code(secret, 1)},
        headers=BEARER,
    )
    device_id, old_trust = verify.json["device_id"], verify.json["device_trust"]
    refresh_token = verify.json["refresh_token"]

    rotated = client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
        headers={**BEARER, "X-Device-Trust": old_trust},
    )
    new_trust = rotated.json["device_trust"]
    assert new_trust and new_trust != old_trust

    # The stolen (old) trust secret no longer skips 2FA — it was rotated out.
    stolen = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD},
        headers={**BEARER, "X-Device-Id": device_id, "X-Device-Trust": old_trust},
    )
    assert stolen.json["mfa_required"] is True


# ── Trust wiped on password reset ────────────────────────────────────────────────────


def test_password_reset_clears_device_trust(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    access = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=BEARER
    ).json["access_token"]
    secret = _enroll_totp(client, access)
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD, "remember_me": True, "grant_trust": True},
        headers=BEARER,
    )
    verify = client.post(
        "/api/auth/totp/verify",
        json={"challenge_token": login.json["challenge_token"], "code": _totp_code(secret, 1)},
        headers=BEARER,
    )
    device_id, trust = verify.json["device_id"], verify.json["device_trust"]

    client.post("/api/auth/forgot-password", json={"email": EMAIL})
    reset_token = re.search(
        r"/reset-password/([A-Za-z0-9_-]+)", mailbox.sent[-1].text_body
    ).group(1)
    new_password = "a whole new passphrase entirely"
    assert (
        client.post(
            "/api/auth/reset-password", json={"token": reset_token, "password": new_password}
        ).status_code
        == 200
    )

    # Trust is gone: the same device must complete 2FA again.
    after = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": new_password},
        headers={**BEARER, "X-Device-Id": device_id, "X-Device-Trust": trust},
    )
    assert after.json["mfa_required"] is True


# ── Device management endpoints ──────────────────────────────────────────────────────


def test_list_rename_and_revoke_devices(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    login = client.post(
        "/api/auth/login",
        json={"email": EMAIL, "password": PASSWORD, "remember_me": True},
        headers=BEARER,
    )
    access, device_id_token = login.json["access_token"], login.json["device_id"]
    dev_headers = {**_auth(access), "X-Device-Id": device_id_token}

    listed = client.get("/api/auth/devices", headers=dev_headers)
    assert listed.status_code == 200
    devices = listed.json["devices"]
    assert len(devices) == 1
    assert devices[0]["current"] is True
    device_pk = devices[0]["id"]

    renamed = client.patch(
        f"/api/auth/devices/{device_pk}", headers=dev_headers, json={"name": "Dora's laptop"}
    )
    assert renamed.status_code == 204
    again = client.get("/api/auth/devices", headers=dev_headers)
    assert again.json["devices"][0]["name"] == "Dora's laptop"

    # Revoking the device kills its refresh family.
    revoked = client.delete(f"/api/auth/devices/{device_pk}", headers=dev_headers)
    assert revoked.status_code == 204
    dead = client.post(
        "/api/auth/refresh", json={"refresh_token": login.json["refresh_token"]}, headers=BEARER
    )
    assert dead.status_code == 401


def test_another_users_device_is_404(client, mailbox) -> None:
    _register_and_activate(client, mailbox)
    mine = client.post(
        "/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, headers=BEARER
    ).json["access_token"]

    # A second, unrelated user.
    other = "evan@example.com"
    client.post(
        "/api/auth/register",
        json={"email": other, "password": PASSWORD, "display_name": "Evan"},
    )
    tok = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[-1].text_body).group(1)
    client.post("/api/auth/activate", json={"token": tok})
    other_login = client.post(
        "/api/auth/login", json={"email": other, "password": PASSWORD}, headers=BEARER
    )
    other_access, other_device = other_login.json["access_token"], other_login.json["device_id"]
    other_pk = client.get(
        "/api/auth/devices", headers={**_auth(other_access), "X-Device-Id": other_device}
    ).json["devices"][0]["id"]

    # I must not be able to see or touch Evan's device.
    assert (
        client.delete(f"/api/auth/devices/{other_pk}", headers=_auth(mine)).status_code == 404
    )
    assert (
        client.patch(
            f"/api/auth/devices/{other_pk}", headers=_auth(mine), json={"name": "x"}
        ).status_code
        == 404
    )
