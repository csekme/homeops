"""Service-layer domain errors. The API layer maps these to HTTP responses, keeping
messages generic where needed to avoid user enumeration (plan §3.5f)."""

from __future__ import annotations


class AuthError(Exception):
    """Base for authentication/authorization failures."""


class PermissionDenied(Exception):
    """The current membership's role lacks the permission for this operation (→ 403).

    Standalone (not under ``AuthError``) so it maps to 403 — *authenticated but not
    authorized* — and is never accidentally caught alongside the 401 auth flows.
    Carries the offending ``permission`` for logging/diagnostics; the HTTP message
    stays generic (plan §4.2)."""

    def __init__(self, permission: str) -> None:
        super().__init__(f"permission denied: {permission}")
        self.permission = permission


class InvalidCredentials(AuthError):
    """Email/password did not match (generic message — no enumeration)."""


class AccountNotActivated(AuthError):
    """Login attempted before the account was activated (plan §3.5b → 403)."""


class InvalidActivationToken(AuthError):
    """Activation token unknown, expired or already used."""


class InvalidRefreshSession(AuthError):
    """Refresh token unknown/expired, or reuse detected (family revoked)."""


class MfaRequired(AuthError):
    """Password verified, but the account has 2FA enabled — a TOTP challenge is needed.

    Carries the short-lived challenge token the client must echo back to
    ``/auth/totp/verify`` with a code (feature plan §Backend.7)."""

    def __init__(self, challenge_token: str) -> None:
        super().__init__("two-factor authentication required")
        self.challenge_token = challenge_token


class TotpNotConfigured(AuthError):
    """A TOTP operation was attempted but the user has no (confirmed) enrolment."""


class TotpAlreadyEnabled(AuthError):
    """Setup attempted while 2FA is already confirmed/enabled for the user."""


class InvalidTotpCode(AuthError):
    """The supplied TOTP / backup code did not verify (generic — no enumeration)."""


class TotpReuse(AuthError):
    """A TOTP code for an already-consumed time-step was replayed (replay protection)."""
