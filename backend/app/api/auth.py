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
CLIENT_TYPE_HEADER = "X-Client-Type"
REFRESH_HEADER = "X-Refresh-Token"


def _is_mobile() -> bool:
    """Mobile clients self-identify so we hand the refresh token back in the body (no cookie
    jar) and skip CSRF (no ambient cookie → no CSRF vector, plan §M.5)."""
    return request.headers.get(CLIENT_TYPE_HEADER, "").lower() == "mobile"


def _body_refresh_token() -> str | None:
    """Read the refresh token a mobile client sends in the body or the X-Refresh-Token header."""
    header = request.headers.get(REFRESH_HEADER)
    if header:
        return header
    payload = request.get_json(silent=True) or {}
    token = payload.get("refresh_token") if isinstance(payload, dict) else None
    return token if isinstance(token, str) and token else None


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
    """Build the access-token + user body and deliver the refresh token to the right place.

    Web (default): HttpOnly refresh + CSRF cookies (XSS-exfiltration safe in the browser).
    Mobile (``X-Client-Type: mobile``): the refresh token goes in the body instead — there
    is no cookie jar — and no cookies/CSRF are emitted.

    Shared by ``/login`` and ``/totp/verify`` so both emit an identical session payload.
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
    if _is_mobile():
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
    cookie_refresh = request.cookies.get(REFRESH_COOKIE)
    if cookie_refresh:
        # Cookie-based (web): the ambient cookie is a CSRF vector → double-submit required.
        if not verify_csrf(request.cookies.get(CSRF_COOKIE), request.headers.get(CSRF_HEADER)):
            abort(403, "Missing or invalid CSRF token.")
        raw_refresh: str | None = cookie_refresh
        mobile = False
    else:
        # Cookie-less (mobile): the refresh token rides in the body/header. No ambient
        # credential → no CSRF check (plan §M.5).
        raw_refresh = _body_refresh_token()
        mobile = True

    if not raw_refresh:
        abort(401, "Missing refresh token.")

    try:
        rotated = auth_service.refresh(
            raw_refresh=raw_refresh,
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
    except InvalidRefreshSession:
        if not mobile:
            _clear_session_cookies()
        abort(401, "Invalid refresh session.")

    body: dict[str, str] = {"access_token": rotated.access_token, "token_type": "Bearer"}  # nosec B105
    if mobile:
        body["refresh_token"] = rotated.refresh_token
    else:
        _attach_session_cookies(rotated.refresh_token, rotated.csrf_token)
    return body


@auth_bp.post("/logout")
@auth_bp.output(EmptySchema, status_code=204)
@auth_bp.doc(
    summary="Revoke the refresh family and clear cookies.", operation_id="logout", tags=["Auth"]
)
def logout() -> tuple[str, int]:
    # Web revokes by the cookie; mobile by the body/header refresh token (no cookie jar).
    raw_refresh = request.cookies.get(REFRESH_COOKIE) or _body_refresh_token()
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
    return {
        "id": view.id,
        "email": view.email,
        "display_name": view.display_name,
        "status": view.status,
        "memberships": [
            {
                "household_id": m.household_id,
                "household_name": m.household_name,
                "role": m.role,
            }
            for m in view.memberships
        ],
    }
