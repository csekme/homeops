"""End-to-end 2FA flow (feature plan §Verification): setup → confirm → login(mfa_required)
→ verify → me; backup-code login; replay rejection; password step-up on disable/regenerate.
"""

from __future__ import annotations

import datetime
import re

import pyotp
import pytest

pytestmark = pytest.mark.integration

EMAIL = "tina@example.com"
PASSWORD = "correct horse battery staple"


def _register_activate_login(client, mailbox) -> str:
    r = client.post(
        "/api/auth/register",
        json={"email": EMAIL, "password": PASSWORD, "display_name": "Tina"},
    )
    assert r.status_code == 202
    token = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[-1].text_body).group(1)
    assert client.post("/api/auth/activate", json={"token": token}).status_code == 200
    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert login.status_code == 200
    return login.json["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _totp_code(secret: str, offset: int = 0) -> str:
    t = pyotp.TOTP(secret)
    step = t.timecode(datetime.datetime.now()) + offset
    return t.generate_otp(step)


def _enroll(client, token: str) -> tuple[str, list[str]]:
    setup = client.post("/api/auth/totp/setup", headers=_auth(token))
    assert setup.status_code == 200
    secret = setup.json["secret"]
    assert setup.json["provisioning_uri"].startswith("otpauth://totp/")

    confirm = client.post(
        "/api/auth/totp/confirm", headers=_auth(token), json={"code": _totp_code(secret)}
    )
    assert confirm.status_code == 200
    codes = confirm.json["codes"]
    assert len(codes) == 10
    return secret, codes


def test_enroll_then_login_with_totp(client, mailbox) -> None:
    token = _register_activate_login(client, mailbox)
    secret, _ = _enroll(client, token)

    status = client.get("/api/auth/totp/status", headers=_auth(token))
    assert status.json == {"enabled": True, "recovery_codes_remaining": 10}

    # Login now stops at step 1: a challenge, no session.
    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert login.status_code == 200
    assert login.json["mfa_required"] is True
    assert "access_token" not in login.json
    challenge = login.json["challenge_token"]
    assert "Set-Cookie" not in login.headers

    # The challenge token must NOT authenticate a normal endpoint.
    assert client.get("/api/auth/me", headers=_auth(challenge)).status_code == 401

    # Step 2: a code from a later step (within the ±1 window, above the confirm step).
    verify = client.post(
        "/api/auth/totp/verify", json={"challenge_token": challenge, "code": _totp_code(secret, 1)}
    )
    assert verify.status_code == 200
    access = verify.json["access_token"]
    assert "refresh_token=" in ";".join(verify.headers.getlist("Set-Cookie"))

    me = client.get("/api/auth/me", headers=_auth(access))
    assert me.status_code == 200
    assert me.json["email"] == EMAIL


def test_login_with_backup_code_consumes_it(client, mailbox) -> None:
    token = _register_activate_login(client, mailbox)
    _, codes = _enroll(client, token)

    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    challenge = login.json["challenge_token"]

    verify = client.post(
        "/api/auth/totp/verify", json={"challenge_token": challenge, "code": codes[0]}
    )
    assert verify.status_code == 200

    status = client.get("/api/auth/totp/status", headers=_auth(verify.json["access_token"]))
    assert status.json["recovery_codes_remaining"] == 9

    # The same backup code can't be reused.
    relogin = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    replay = client.post(
        "/api/auth/totp/verify",
        json={"challenge_token": relogin.json["challenge_token"], "code": codes[0]},
    )
    assert replay.status_code == 401


def test_totp_code_replay_is_rejected(client, mailbox) -> None:
    token = _register_activate_login(client, mailbox)
    secret, _ = _enroll(client, token)

    reuse_code = _totp_code(secret, 1)  # same string used twice → same absolute step

    first = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    ok = client.post(
        "/api/auth/totp/verify",
        json={"challenge_token": first.json["challenge_token"], "code": reuse_code},
    )
    assert ok.status_code == 200

    second = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    replay = client.post(
        "/api/auth/totp/verify",
        json={"challenge_token": second.json["challenge_token"], "code": reuse_code},
    )
    assert replay.status_code == 401


def test_disable_requires_correct_password(client, mailbox) -> None:
    token = _register_activate_login(client, mailbox)
    _enroll(client, token)

    bad = client.post("/api/auth/totp/disable", headers=_auth(token), json={"password": "nope"})
    assert bad.status_code == 401

    ok = client.post("/api/auth/totp/disable", headers=_auth(token), json={"password": PASSWORD})
    assert ok.status_code == 204

    assert client.get("/api/auth/totp/status", headers=_auth(token)).json["enabled"] is False
    # 2FA off → login issues a session directly again.
    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    assert login.json.get("mfa_required") is None
    assert "access_token" in login.json


def test_regenerate_recovery_codes_replaces_them(client, mailbox) -> None:
    token = _register_activate_login(client, mailbox)
    _, codes = _enroll(client, token)

    bad = client.post(
        "/api/auth/totp/recovery/regenerate", headers=_auth(token), json={"password": "nope"}
    )
    assert bad.status_code == 401

    regen = client.post(
        "/api/auth/totp/recovery/regenerate", headers=_auth(token), json={"password": PASSWORD}
    )
    assert regen.status_code == 200
    assert len(regen.json["codes"]) == 10
    assert set(regen.json["codes"]).isdisjoint(codes)  # old codes invalidated

    # An old backup code no longer works at login.
    login = client.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD})
    replay = client.post(
        "/api/auth/totp/verify",
        json={"challenge_token": login.json["challenge_token"], "code": codes[0]},
    )
    assert replay.status_code == 401
