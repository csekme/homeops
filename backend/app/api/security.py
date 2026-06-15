"""Bearer access-token guard wired into APIFlask's OpenAPI security scheme."""

from __future__ import annotations

from apiflask import HTTPTokenAuth
from flask import current_app

from app.security.jwt_tokens import AccessClaims, TokenError, decode_access_token

bearer_auth = HTTPTokenAuth(scheme="Bearer")


@bearer_auth.verify_token
def _verify_token(token: str) -> AccessClaims | None:
    try:
        return decode_access_token(token, secret=current_app.config["JWT_SECRET_KEY"])
    except TokenError:
        return None
