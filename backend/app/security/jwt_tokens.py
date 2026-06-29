"""Access-token issuance/verification (plan §3.5c).

Short-lived JWT (HS256, env secret), returned in the login response body — the web client
keeps it in memory, the mobile client in secure store. Claims: ``sub``, ``exp``, ``iat``,
``jti`` and, once the user has an active membership, ``household_id`` + ``role``.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import jwt

_ALGORITHM = "HS256"

#: Marks the short-lived token issued between password check and 2FA verification
#: (feature plan §Backend.7). Kept distinct from access tokens so the bearer guard
#: refuses it on normal endpoints.
MFA_PURPOSE = "mfa"


@dataclass(frozen=True)
class AccessClaims:
    sub: str
    jti: str
    household_id: str | None
    role: str | None


@dataclass(frozen=True)
class MfaChallengeClaims:
    sub: str
    jti: str
    # Device context carried across the 2FA step so step 2 can re-attach the session to the
    # same device, honour the "remember me" TTL, and (re)grant trust (feature plan §Device).
    device_id: str | None
    remember: bool
    grant_trust: bool


class TokenError(Exception):
    """Raised when an access token is invalid, expired or malformed."""


def encode_access_token(
    *,
    user_id: uuid.UUID | str,
    secret: str,
    ttl_minutes: int,
    household_id: uuid.UUID | str | None = None,
    role: str | None = None,
) -> str:
    now = datetime.now(UTC)
    payload: dict[str, object] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl_minutes)).timestamp()),
        "jti": uuid.uuid4().hex,
    }
    if household_id is not None:
        payload["household_id"] = str(household_id)
    if role is not None:
        payload["role"] = role
    return jwt.encode(payload, secret, algorithm=_ALGORITHM)


def decode_access_token(token: str, *, secret: str) -> AccessClaims:
    try:
        payload = jwt.decode(token, secret, algorithms=[_ALGORITHM])
    except jwt.PyJWTError as exc:  # expired, bad signature, malformed …
        raise TokenError(str(exc)) from exc
    # A purpose-tagged token (e.g. the MFA challenge) must never authenticate a normal
    # endpoint, even though it is signed with the same secret.
    if payload.get("purpose") is not None:
        raise TokenError("not an access token")
    sub = payload.get("sub")
    jti = payload.get("jti")
    if not isinstance(sub, str) or not isinstance(jti, str):
        raise TokenError("missing required claims")
    return AccessClaims(
        sub=sub,
        jti=jti,
        household_id=payload.get("household_id"),
        role=payload.get("role"),
    )


def encode_mfa_challenge(
    *,
    user_id: uuid.UUID | str,
    secret: str,
    ttl_minutes: int,
    device_id: uuid.UUID | str | None = None,
    remember: bool = False,
    grant_trust: bool = False,
) -> str:
    """Mint the short-lived challenge token carried between login step 1 and step 2."""
    now = datetime.now(UTC)
    payload: dict[str, object] = {
        "sub": str(user_id),
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=ttl_minutes)).timestamp()),
        "jti": uuid.uuid4().hex,
        "purpose": MFA_PURPOSE,
        "remember": remember,
        "grant_trust": grant_trust,
    }
    if device_id is not None:
        payload["device_id"] = str(device_id)
    return jwt.encode(payload, secret, algorithm=_ALGORITHM)


def decode_mfa_challenge(token: str, *, secret: str) -> MfaChallengeClaims:
    try:
        payload = jwt.decode(token, secret, algorithms=[_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise TokenError(str(exc)) from exc
    if payload.get("purpose") != MFA_PURPOSE:
        raise TokenError("not an mfa challenge token")
    sub = payload.get("sub")
    jti = payload.get("jti")
    if not isinstance(sub, str) or not isinstance(jti, str):
        raise TokenError("missing required claims")
    device_id = payload.get("device_id")
    return MfaChallengeClaims(
        sub=sub,
        jti=jti,
        device_id=device_id if isinstance(device_id, str) else None,
        remember=bool(payload.get("remember", False)),
        grant_trust=bool(payload.get("grant_trust", False)),
    )
