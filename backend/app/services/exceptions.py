"""Service-layer domain errors. The API layer maps these to HTTP responses, keeping
messages generic where needed to avoid user enumeration (plan §3.5f)."""

from __future__ import annotations


class AuthError(Exception):
    """Base for authentication/authorization failures."""


class InvalidCredentials(AuthError):
    """Email/password did not match (generic message — no enumeration)."""


class AccountNotActivated(AuthError):
    """Login attempted before the account was activated (plan §3.5b → 403)."""


class InvalidActivationToken(AuthError):
    """Activation token unknown, expired or already used."""


class InvalidRefreshSession(AuthError):
    """Refresh token unknown/expired, or reuse detected (family revoked)."""
