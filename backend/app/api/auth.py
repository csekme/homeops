"""Auth endpoints (plan §3.5): register, activate, login, refresh, logout, me.

Thin controllers: validate input (schemas), delegate to ``auth_service``, translate
domain errors to HTTP, and manage the refresh/CSRF cookies. Rate limits guard the
credential endpoints (plan §3.5f) with generic errors (no user enumeration).
"""

from __future__ import annotations

from typing import cast

from apiflask import APIBlueprint, abort
from apiflask.schemas import EmptySchema
from flask import after_this_request, current_app, request

from app.api.schemas import (
    ActivateIn,
    LoginIn,
    LoginOut,
    MessageOut,
    RefreshOut,
    RegisterIn,
    UserOut,
)
from app.api.security import bearer_auth
from app.extensions import limiter
from app.security.csrf import CSRF_HEADER, verify_csrf
from app.security.jwt_tokens import AccessClaims
from app.services import auth_service
from app.services.exceptions import (
    AccountNotActivated,
    InvalidActivationToken,
    InvalidCredentials,
    InvalidRefreshSession,
    MfaRequired,
)

auth_bp = APIBlueprint("auth", __name__, url_prefix="/api/auth")

REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"

# Mobile clients can't hold an HttpOnly refresh cookie, so they opt into a bearer/body
# token transport with this header (plan §3, phase0-mobile). When present the refresh token
# travels in the JSON body instead of a Set-Cookie, and CSRF is skipped (no ambient cookie
# auth to forge). Absent → the unchanged web cookie+CSRF path. Web never sends it.
AUTH_TRANSPORT_HEADER = "X-Auth-Transport"


def _wants_bearer_transport() -> bool:
    return request.headers.get(AUTH_TRANSPORT_HEADER, "").strip().lower() == "bearer"


def _attach_session_cookies(refresh_token: str, csrf_token: str) -> None:
    cfg = current_app.config
    max_age = cfg["REFRESH_TOKEN_TTL_DAYS"] * 86400
    secure = cfg["AUTH_COOKIE_SECURE"]
    refresh_path = cfg["AUTH_COOKIE_PATH"]
    csrf_path = cfg["CSRF_COOKIE_PATH"]

    @after_this_request
    def _set(response):
        # Refresh: HttpOnly so JS can't read it; scoped to the auth path so it is only
        # ever sent to /api/auth/* (the browser attaches it to refresh/logout).
        response.set_cookie(
            REFRESH_COOKIE,
            refresh_token,
            max_age=max_age,
            httponly=True,
            secure=secure,
            samesite="Strict",
            path=refresh_path,
        )
        # CSRF: NOT HttpOnly and Path=/ so the SPA can read it anywhere and echo it in
        # the X-CSRF-Token header (double-submit). The browser still sends it to
        # /api/auth/refresh alongside the refresh cookie.
        response.set_cookie(
            CSRF_COOKIE,
            csrf_token,
            max_age=max_age,
            httponly=False,
            secure=secure,
            samesite="Strict",
            path=csrf_path,
        )
        return response


def issue_session_response(issued: auth_service.IssuedSession) -> dict[str, object]:
    """Build the access-token + user body and deliver the refresh/CSRF tokens.

    Shared by ``/login`` and ``/totp/verify`` so both emit an identical session payload.
    Web (default): refresh + CSRF go out as cookies. Mobile (``X-Auth-Transport: bearer``):
    no Set-Cookie — the refresh token rides in the body for expo-secure-store.
    """
    body: dict[str, object] = {
        "access_token": issued.access_token,
        "token_type": "Bearer",  # nosec B105 — OAuth token type, not a secret
        "user": {
            "id": str(issued.user.id),
            "email": issued.user.email,
            "display_name": issued.user.display_name,
            "status": issued.user.status,
            "memberships": [],
        },
    }
    if _wants_bearer_transport():
        body["refresh_token"] = issued.refresh_token
    else:
        _attach_session_cookies(issued.refresh_token, issued.csrf_token)
    return body


def _clear_session_cookies() -> None:
    cfg = current_app.config

    @after_this_request
    def _clear(response):
        response.delete_cookie(REFRESH_COOKIE, path=cfg["AUTH_COOKIE_PATH"])
        response.delete_cookie(CSRF_COOKIE, path=cfg["CSRF_COOKIE_PATH"])
        return response


@auth_bp.post("/register")
@auth_bp.input(RegisterIn)
@auth_bp.output(MessageOut, status_code=202)
@auth_bp.doc(
    summary="Register a new account; emails a single-use activation link.",
    operation_id="register",
    tags=["Auth"],
)
@limiter.limit("10 per hour")
def register(json_data: dict) -> dict[str, str]:
    auth_service.register(
        email=json_data["email"],
        password=json_data["password"],
        display_name=json_data["display_name"],
        locale=json_data.get("locale"),
    )
    # Generic response regardless of whether the email already existed (no enumeration).
    return {"message": "If the address is valid, an activation email has been sent."}


@auth_bp.post("/activate")
@auth_bp.input(ActivateIn)
@auth_bp.output(MessageOut)
@auth_bp.doc(
    summary="Activate an account with the emailed token.", operation_id="activate", tags=["Auth"]
)
@limiter.limit("20 per hour")
def activate(json_data: dict) -> dict[str, str]:
    try:
        auth_service.activate(raw_token=json_data["token"])
    except InvalidActivationToken:
        abort(400, "Invalid or expired activation token.")
    return {"message": "Account activated. You can now sign in."}


@auth_bp.post("/login")
@auth_bp.input(LoginIn)
@auth_bp.output(LoginOut)
@auth_bp.doc(
    summary="Exchange credentials for an access token (+ refresh/CSRF cookies).",
    operation_id="login",
    tags=["Auth"],
)
@limiter.limit("10 per minute")
def login(json_data: dict) -> dict[str, object]:
    try:
        issued = auth_service.login(
            email=json_data["email"],
            password=json_data["password"],
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
    except MfaRequired as exc:
        # Password OK but 2FA is on: hand back a challenge token (no session yet).
        return {"mfa_required": True, "challenge_token": exc.challenge_token}
    except AccountNotActivated:
        abort(403, "Account is not activated.")
    except InvalidCredentials:
        abort(401, "Invalid email or password.")

    return issue_session_response(issued)


@auth_bp.post("/refresh")
@auth_bp.output(RefreshOut)
@auth_bp.doc(
    summary="Rotate the refresh token (CSRF + cookie required).",
    operation_id="refresh",
    tags=["Auth"],
)
@limiter.limit("60 per minute")
def refresh() -> dict[str, str]:
    # Bearer transport: the token comes in the body and CSRF is skipped (no cookie to forge).
    # The header is the trigger, but a body token alone also selects this path so a mobile
    # client works even if a proxy strips the header. Web sends neither → cookie+CSRF path.
    body = request.get_json(silent=True) or {}
    body_refresh = body.get("refresh_token")
    bearer = _wants_bearer_transport() or bool(body_refresh)

    if bearer:
        raw_refresh = body_refresh
        if not raw_refresh:
            abort(401, "Missing refresh token.")
    else:
        if not verify_csrf(request.cookies.get(CSRF_COOKIE), request.headers.get(CSRF_HEADER)):
            abort(403, "Missing or invalid CSRF token.")
        raw_refresh = request.cookies.get(REFRESH_COOKIE)
        if not raw_refresh:
            abort(401, "Missing refresh token.")

    try:
        rotated = auth_service.refresh(
            raw_refresh=raw_refresh,
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
    except InvalidRefreshSession:
        if not bearer:
            _clear_session_cookies()
        abort(401, "Invalid refresh session.")

    if bearer:
        return {  # nosec B105
            "access_token": rotated.access_token,
            "token_type": "Bearer",
            "refresh_token": rotated.refresh_token,
        }

    _attach_session_cookies(rotated.refresh_token, rotated.csrf_token)
    return {"access_token": rotated.access_token, "token_type": "Bearer"}  # nosec B105


@auth_bp.post("/logout")
@auth_bp.output(EmptySchema, status_code=204)
@auth_bp.doc(
    summary="Revoke the refresh family and clear cookies.", operation_id="logout", tags=["Auth"]
)
def logout() -> tuple[str, int]:
    # Mobile presents the refresh token in the body; web carries it in the cookie. Clearing
    # cookies is harmless for mobile (there are none) so we keep one exit path.
    body = request.get_json(silent=True) or {}
    raw_refresh = body.get("refresh_token") or request.cookies.get(REFRESH_COOKIE)
    auth_service.logout(raw_refresh=raw_refresh)
    _clear_session_cookies()
    return "", 204


@auth_bp.get("/me")
@auth_bp.auth_required(bearer_auth)
@auth_bp.output(UserOut)
@auth_bp.doc(
    summary="Return the authenticated user and their memberships.",
    operation_id="getMe",
    tags=["Auth"],
)
def me() -> dict[str, object]:
    # @auth_required guarantees current_user is populated.
    claims = cast(AccessClaims, bearer_auth.current_user)
    view = auth_service.get_me(user_id=claims.sub)
    if view is None:
        abort(404, "User not found.")
    # The token claim can lag reality (e.g. the active household was archived since it was
    # issued). Only report an active household that the user still has a live membership in;
    # otherwise null it so the client doesn't point at a vanished tenant until the next refresh.
    live_household_ids = {m.household_id for m in view.memberships}
    active_household_id = (
        claims.household_id if claims.household_id in live_household_ids else None
    )
    return {
        "id": view.id,
        "email": view.email,
        "display_name": view.display_name,
        "status": view.status,
        "active_household_id": active_household_id,
        "memberships": [
            {
                "household_id": m.household_id,
                "household_name": m.household_name,
                "role": m.role,
            }
            for m in view.memberships
        ],
    }
