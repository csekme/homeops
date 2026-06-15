"""Double-submit CSRF for the cookie-bound refresh endpoint (plan §3.5e, spec §7.1).

The refresh token lives in an ``HttpOnly`` cookie, so the browser attaches it
automatically — that is exactly what CSRF abuses. We pair it with a non-HttpOnly CSRF
cookie whose value JS must echo back in the ``X-CSRF-Token`` header; combined with
``SameSite=Strict`` this blocks cross-site refresh attempts.
"""

from __future__ import annotations

import hmac
import secrets

CSRF_HEADER = "X-CSRF-Token"


def issue_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def verify_csrf(cookie_value: str | None, header_value: str | None) -> bool:
    if not cookie_value or not header_value:
        return False
    return hmac.compare_digest(cookie_value, header_value)
