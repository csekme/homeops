"""TOTP primitives (feature plan §Backend.4) — a thin wrapper over ``pyotp``.

Keeps the service layer independent of the library and centralizes the RFC 6238
parameters (SHA-1, 6 digits, 30s step) that Google/Microsoft Authenticator expect.
"""

from __future__ import annotations

import datetime

import pyotp

#: Default acceptance window (in steps) on each side of the current time-step, to tolerate
#: client/server clock skew. ``valid_window=1`` ⇒ previous, current and next step accepted.
DEFAULT_VALID_WINDOW = 1

_DIGITS = 6
_INTERVAL = 30
_ISSUER = "HomeOps"


def _totp(secret: str) -> pyotp.TOTP:
    return pyotp.TOTP(secret, digits=_DIGITS, interval=_INTERVAL)


def generate_secret() -> str:
    """A fresh random base32 secret suitable for an authenticator app."""
    return pyotp.random_base32()


def provisioning_uri(secret: str, account_email: str, *, issuer: str = _ISSUER) -> str:
    """The ``otpauth://`` URI the frontend renders as a QR code."""
    return _totp(secret).provisioning_uri(name=account_email, issuer_name=issuer)


def now_step(secret: str) -> int:
    """The current TOTP time-step index for ``secret`` (matches the index ``verify`` returns)."""
    return _totp(secret).timecode(datetime.datetime.now())


def verify(secret: str, code: str, *, valid_window: int = DEFAULT_VALID_WINDOW) -> int | None:
    """Verify ``code`` against ``secret``; return the accepted time-step index, or ``None``.

    The step index is returned (not just a bool) so the caller can enforce replay
    protection: a code whose step was already consumed must be rejected.
    """
    code = code.strip().replace(" ", "")
    if len(code) != _DIGITS or not code.isdigit():
        return None
    totp = _totp(secret)
    now = datetime.datetime.now()
    current = totp.timecode(now)
    for offset in range(-valid_window, valid_window + 1):
        # at(..., counter_offset=offset) generates the code for step (current + offset).
        if totp.at(now, counter_offset=offset) == code:
            return current + offset
    return None
