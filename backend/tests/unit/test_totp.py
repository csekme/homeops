"""Unit tests for the TOTP + recovery-code primitives (feature plan §Verification)."""

from __future__ import annotations

import datetime

import pyotp

from app.security import recovery_codes, totp


def _code_for_step(secret: str, step: int) -> str:
    return pyotp.TOTP(secret).generate_otp(step)


def test_verify_accepts_current_code_and_returns_step() -> None:
    secret = totp.generate_secret()
    code = pyotp.TOTP(secret).now()

    step = totp.verify(secret, code)

    assert step is not None
    assert step == totp.now_step(secret)


def test_verify_rejects_wrong_code() -> None:
    secret = totp.generate_secret()
    # An epoch code is far outside the current ±1 window → never valid "now".
    assert totp.verify(secret, pyotp.TOTP(secret).at(0)) is None


def test_verify_rejects_non_numeric_and_wrong_length() -> None:
    secret = totp.generate_secret()
    assert totp.verify(secret, "abcdef") is None
    assert totp.verify(secret, "12345") is None
    assert totp.verify(secret, "1234567") is None


def test_verify_window_accepts_adjacent_step() -> None:
    secret = totp.generate_secret()
    current = pyotp.TOTP(secret).timecode(datetime.datetime.now())

    assert totp.verify(secret, _code_for_step(secret, current - 1)) == current - 1
    assert totp.verify(secret, _code_for_step(secret, current + 1)) == current + 1


def test_verify_rejects_step_outside_window() -> None:
    secret = totp.generate_secret()
    current = pyotp.TOTP(secret).timecode(datetime.datetime.now())
    # Two steps away is outside the default ±1 window.
    assert totp.verify(secret, _code_for_step(secret, current + 2)) is None


def test_recovery_codes_are_unique_and_formatted() -> None:
    codes = recovery_codes.generate(10)
    assert len(codes) == 10
    assert len(set(codes)) == 10
    for code in codes:
        assert code.count("-") == 2
        assert recovery_codes.normalize(code).isalnum()


def test_recovery_hash_is_normalization_insensitive() -> None:
    raw = recovery_codes.generate(1)[0]
    assert recovery_codes.hash_code(raw) == recovery_codes.hash_code(raw.upper())
    assert recovery_codes.hash_code(raw) == recovery_codes.hash_code(raw.replace("-", ""))
