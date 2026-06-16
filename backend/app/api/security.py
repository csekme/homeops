"""Bearer access-token guard wired into APIFlask's OpenAPI security scheme,
plus the ``current_membership`` resolver that turns the verified token claims into
the tenant context every tenant-scoped controller/service operates on."""

from __future__ import annotations

from typing import cast

from apiflask import HTTPTokenAuth, abort
from flask import current_app

from app.domain.enums import Role as RoleEnum
from app.security.jwt_tokens import AccessClaims, TokenError, decode_access_token
from app.security.rbac import MembershipContext

bearer_auth = HTTPTokenAuth(scheme="Bearer")


@bearer_auth.verify_token
def _verify_token(token: str) -> AccessClaims | None:
    try:
        return decode_access_token(token, secret=current_app.config["JWT_SECRET_KEY"])
    except TokenError:
        return None


def current_membership() -> MembershipContext:
    """Build the tenant context from the verified access-token claims.

    Call only behind ``@auth_required(bearer_auth)``. The household + role come from the
    token (set at login/switch from the user's real membership) — never from the request
    body — which is the same invariant RLS relies on. A token without an active membership
    (no ``household_id``/``role``) or with an unknown role is rejected with 403.
    """
    claims = cast(AccessClaims, bearer_auth.current_user)
    if claims.household_id is None or claims.role is None:
        abort(403, "No active household membership.")
    try:
        role = RoleEnum(claims.role)
    except ValueError:
        abort(403, "Unknown role.")
    return MembershipContext(
        user_id=claims.sub,
        household_id=claims.household_id,
        role=role,
    )
