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


@dataclass(frozen=True)
class AccessClaims:
    sub: str
    jti: str
    household_id: str | None
    role: str | None


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
