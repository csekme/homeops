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
    AvatarUploadIn,
    DeviceListOut,
    DeviceRenameIn,
    ForgotPasswordIn,
    LoginIn,
    LoginOut,
    MessageOut,
    RefreshOut,
    RegisterIn,
    ResetPasswordIn,
    UserOut,
)
from app.api.security import bearer_auth
from app.extensions import limiter
from app.security.csrf import CSRF_HEADER, verify_csrf
from app.security.jwt_tokens import AccessClaims
from app.services import auth_service, avatar_service, device_service
from app.services.exceptions import (
    AccountNotActivated,
    DeviceNotFound,
    InvalidActivationToken,
    InvalidAvatarImage,
    InvalidCredentials,
    InvalidPasswordResetToken,
    InvalidRefreshSession,
    MfaRequired,
)

auth_bp = APIBlueprint("auth", __name__, url_prefix="/api/auth")

REFRESH_COOKIE = "refresh_token"
CSRF_COOKIE = "csrf_token"
# Device-identity + 2FA-bypass cookies (feature plan §Device). Both HttpOnly + path-scoped to
# /api/auth (only sent to auth endpoints). The identity cookie recognises the device for the
# session list; the trust cookie waives 2FA within its window and rotates on every refresh.
DEVICE_ID_COOKIE = "device_id"
DEVICE_TRUST_COOKIE = "device_trust"

# Mobile clients can't hold an HttpOnly refresh cookie, so they opt into a bearer/body
# token transport with this header (plan §3, phase0-mobile). When present the refresh token
# travels in the JSON body instead of a Set-Cookie, and CSRF is skipped (no ambient cookie
# auth to forge). Absent → the unchanged web cookie+CSRF path. Web never sends it.
AUTH_TRANSPORT_HEADER = "X-Auth-Transport"
# Mobile (cookie-less) carries the device secrets + platform in headers instead of cookies.
DEVICE_ID_HEADER = "X-Device-Id"
DEVICE_TRUST_HEADER = "X-Device-Trust"
DEVICE_PLATFORM_HEADER = "X-Device-Platform"


def _wants_bearer_transport() -> bool:
    return request.headers.get(AUTH_TRANSPORT_HEADER, "").strip().lower() == "bearer"


def _request_platform() -> str:
    raw = (request.headers.get(DEVICE_PLATFORM_HEADER) or "").strip().lower()
    return raw if raw in {"web", "ios", "android"} else "web"


def _read_device_id_token() -> str | None:
    """The calling device's identity secret — web cookie or mobile header."""
    return request.cookies.get(DEVICE_ID_COOKIE) or request.headers.get(DEVICE_ID_HEADER)


def _read_device_trust_token() -> str | None:
    """The calling device's 2FA-bypass secret — web cookie or mobile header."""
    return request.cookies.get(DEVICE_TRUST_COOKIE) or request.headers.get(DEVICE_TRUST_HEADER)


def _set_session_cookies(
    response,
    *,
    refresh_token: str,
    csrf_token: str,
    remember: bool,
    device_id_token: str | None,
    trust_token: str | None,
):
    cfg = current_app.config
    secure = cfg["AUTH_COOKIE_SECURE"]
    auth_path = cfg["AUTH_COOKIE_PATH"]
    csrf_path = cfg["CSRF_COOKIE_PATH"]
    # Remember on → persistent cookies; off → browser-session cookies (no max-age). The DB
    # refresh expiry is the real lifetime guarantee; the cookie scope is only UX.
    session_max_age = cfg["REFRESH_TOKEN_TTL_DAYS"] * 86400 if remember else None

    # Refresh: HttpOnly so JS can't read it; scoped to the auth path so it is only ever sent
    # to /api/auth/* (the browser attaches it to refresh/logout).
    response.set_cookie(
        REFRESH_COOKIE,
        refresh_token,
        max_age=session_max_age,
        httponly=True,
        secure=secure,
        samesite="Strict",
        path=auth_path,
    )
    # CSRF: NOT HttpOnly and Path=/ so the SPA can read it anywhere and echo it in the
    # X-CSRF-Token header (double-submit). Sent to /api/auth/refresh with the refresh cookie.
    response.set_cookie(
        CSRF_COOKIE,
        csrf_token,
        max_age=session_max_age,
        httponly=False,
        secure=secure,
        samesite="Strict",
        path=csrf_path,
    )
    if device_id_token is not None:
        response.set_cookie(
            DEVICE_ID_COOKIE,
            device_id_token,
            max_age=session_max_age,
            httponly=True,
            secure=secure,
            samesite="Strict",
            path=auth_path,
        )
    if trust_token is not None:
        # Trust has its own window (independent of the session cookie) — always persistent.
        response.set_cookie(
            DEVICE_TRUST_COOKIE,
            trust_token,
            max_age=cfg["DEVICE_TRUST_TTL_DAYS"] * 86400,
            httponly=True,
            secure=secure,
            samesite="Strict",
            path=auth_path,
        )
    return response


def _attach_session_cookies(
    refresh_token: str,
    csrf_token: str,
    *,
    remember: bool,
    device_id_token: str | None = None,
    trust_token: str | None = None,
) -> None:
    @after_this_request
    def _set(response):
        return _set_session_cookies(
            response,
            refresh_token=refresh_token,
            csrf_token=csrf_token,
            remember=remember,
            device_id_token=device_id_token,
            trust_token=trust_token,
        )


def issue_session_response(issued: auth_service.IssuedSession) -> dict[str, object]:
    """Build the access-token + user body and deliver the refresh/CSRF/device tokens.

    Shared by ``/login`` and ``/totp/verify`` so both emit an identical session payload.
    Web (default): refresh + CSRF + device secrets go out as HttpOnly cookies. Mobile
    (``X-Auth-Transport: bearer``): no Set-Cookie — the secrets ride in the body for
    expo-secure-store.
    """
    body: dict[str, object] = {
        "access_token": issued.access_token,
        "token_type": "Bearer",  # nosec B105 — OAuth token type, not a secret
        "user": {
            "id": str(issued.user.id),
            "email": issued.user.email,
            "display_name": issued.user.display_name,
            "status": issued.user.status,
            "avatar_url": avatar_service.avatar_url(
                issued.user.id, issued.user.avatar_updated_at
            ),
            "memberships": [],
        },
    }
    if _wants_bearer_transport():
        body["refresh_token"] = issued.refresh_token
        if issued.device_id_token is not None:
            body["device_id"] = issued.device_id_token
        if issued.trust_token is not None:
            body["device_trust"] = issued.trust_token
    else:
        # Re-set the identity cookie even for a known device so its max-age tracks the latest
        # remember choice (the browser sent the value, so we can echo it when none was minted).
        device_id_token = issued.device_id_token or request.cookies.get(DEVICE_ID_COOKIE)
        _attach_session_cookies(
            issued.refresh_token,
            issued.csrf_token,
            remember=issued.remember,
            device_id_token=device_id_token,
            trust_token=issued.trust_token,
        )
    return body


def _clear_session_cookies() -> None:
    """Clear the session (refresh + CSRF) but KEEP the device identity/trust cookies, so an
    explicit logout doesn't force the user to redo 2FA on a still-trusted device next login."""
    cfg = current_app.config

    @after_this_request
    def _clear(response):
        response.delete_cookie(REFRESH_COOKIE, path=cfg["AUTH_COOKIE_PATH"])
        response.delete_cookie(CSRF_COOKIE, path=cfg["CSRF_COOKIE_PATH"])
        return response


def _clear_device_cookies() -> None:
    """Also forget the device identity + trust (used when revoking the *current* device)."""
    cfg = current_app.config

    @after_this_request
    def _clear(response):
        response.delete_cookie(DEVICE_ID_COOKIE, path=cfg["AUTH_COOKIE_PATH"])
        response.delete_cookie(DEVICE_TRUST_COOKIE, path=cfg["AUTH_COOKIE_PATH"])
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


@auth_bp.post("/forgot-password")
@auth_bp.input(ForgotPasswordIn)
@auth_bp.output(MessageOut, status_code=202)
@auth_bp.doc(
    summary="Request a password-reset email (generic response, no user enumeration).",
    operation_id="forgotPassword",
    tags=["Auth"],
)
@limiter.limit("10 per hour")
def forgot_password(json_data: dict) -> dict[str, str]:
    auth_service.request_password_reset(
        email=json_data["email"], locale=json_data.get("locale")
    )
    # Generic response regardless of whether the email is registered (no enumeration).
    return {"message": "If the address is valid, a password-reset email has been sent."}


@auth_bp.post("/reset-password")
@auth_bp.input(ResetPasswordIn)
@auth_bp.output(MessageOut)
@auth_bp.doc(
    summary="Set a new password with the emailed reset token; revokes all sessions.",
    operation_id="resetPassword",
    tags=["Auth"],
)
@limiter.limit("20 per hour")
def reset_password(json_data: dict) -> dict[str, str]:
    try:
        auth_service.reset_password(
            raw_token=json_data["token"], new_password=json_data["password"]
        )
    except InvalidPasswordResetToken:
        abort(400, "Invalid or expired password-reset token.")
    return {"message": "Your password has been reset. You can now sign in."}


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
            device_id_token=_read_device_id_token(),
            trust_token=_read_device_trust_token(),
            remember=json_data["remember_me"],
            grant_trust=json_data["grant_trust"],
            platform=_request_platform(),
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
            trust_token=_read_device_trust_token(),
        )
    except InvalidRefreshSession:
        if not bearer:
            _clear_session_cookies()
        abort(401, "Invalid refresh session.")

    if bearer:
        out: dict[str, str] = {  # nosec B105
            "access_token": rotated.access_token,
            "token_type": "Bearer",
            "refresh_token": rotated.refresh_token,
        }
        if rotated.trust_token is not None:
            out["device_trust"] = rotated.trust_token
        return out

    # Re-set the identity cookie (echo the incoming value) so its max-age tracks the device's
    # remember choice; the trust cookie is re-set only when it actually rotated.
    _attach_session_cookies(
        rotated.refresh_token,
        rotated.csrf_token,
        remember=rotated.remember,
        device_id_token=request.cookies.get(DEVICE_ID_COOKIE),
        trust_token=rotated.trust_token,
    )
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
    return _me_payload(claims)


def _me_payload(claims: AccessClaims) -> dict[str, object]:
    """Build the ``UserOut`` body for the authenticated user (shared by /me + /avatar)."""
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
        "avatar_url": view.avatar_url,
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


# ── Avatar / profile picture (feature plan §Avatar) ──────────────────────────────────


@auth_bp.put("/avatar")
@auth_bp.auth_required(bearer_auth)
@auth_bp.input(AvatarUploadIn, location="files")
@auth_bp.output(UserOut)
@auth_bp.doc(
    summary="Upload/replace the authenticated user's profile picture.",
    operation_id="setAvatar",
    tags=["Auth"],
)
def set_avatar(files_data: dict) -> dict[str, object]:
    claims = cast(AccessClaims, bearer_auth.current_user)
    upload = files_data["file"]
    try:
        avatar_service.set_avatar(user_id=claims.sub, raw=upload.read())
    except InvalidAvatarImage as exc:
        abort(413 if exc.too_large else 400, str(exc))
    return _me_payload(claims)


@auth_bp.delete("/avatar")
@auth_bp.auth_required(bearer_auth)
@auth_bp.output(EmptySchema, status_code=204)
@auth_bp.doc(
    summary="Remove the authenticated user's profile picture.",
    operation_id="deleteAvatar",
    tags=["Auth"],
)
def delete_avatar() -> tuple[str, int]:
    claims = cast(AccessClaims, bearer_auth.current_user)
    avatar_service.remove_avatar(user_id=claims.sub)
    return "", 204


# ── Device / session management (feature plan §Device registration) ──────────────────


@auth_bp.get("/devices")
@auth_bp.auth_required(bearer_auth)
@auth_bp.output(DeviceListOut)
@auth_bp.doc(
    summary="List the user's active devices/sessions.",
    operation_id="listDevices",
    tags=["Auth"],
)
@limiter.limit("60 per minute")
def list_devices() -> dict[str, object]:
    claims = cast(AccessClaims, bearer_auth.current_user)
    devices = device_service.list_devices(
        user_id=claims.sub, current_device_id_token=_read_device_id_token()
    )
    return {
        "devices": [
            {
                "id": d.id,
                "name": d.name,
                "platform": d.platform,
                "last_ip": d.last_ip,
                "last_seen_at": d.last_seen_at,
                "created_at": d.created_at,
                "trusted": d.trusted,
                "current": d.current,
            }
            for d in devices
        ]
    }


@auth_bp.patch("/devices/<device_id>")
@auth_bp.auth_required(bearer_auth)
@auth_bp.input(DeviceRenameIn)
@auth_bp.output(EmptySchema, status_code=204)
@auth_bp.doc(summary="Rename a device.", operation_id="renameDevice", tags=["Auth"])
@limiter.limit("20 per minute")
def rename_device(device_id: str, json_data: dict) -> tuple[str, int]:
    claims = cast(AccessClaims, bearer_auth.current_user)
    try:
        device_service.rename_device(
            user_id=claims.sub, device_id=device_id, name=json_data["name"]
        )
    except DeviceNotFound:
        abort(404, "Device not found.")
    except ValueError:
        # An unparsable device id is just a non-existent device from the caller's view.
        abort(404, "Device not found.")
    return "", 204


@auth_bp.delete("/devices/<device_id>")
@auth_bp.auth_required(bearer_auth)
@auth_bp.output(EmptySchema, status_code=204)
@auth_bp.doc(
    summary="Revoke (sign out) a single device.", operation_id="revokeDevice", tags=["Auth"]
)
@limiter.limit("20 per minute")
def revoke_device(device_id: str) -> tuple[str, int]:
    claims = cast(AccessClaims, bearer_auth.current_user)
    current_token = _read_device_id_token()
    try:
        is_current = device_service.revoke_device(
            user_id=claims.sub, device_id=device_id, current_device_id_token=current_token
        )
    except DeviceNotFound:
        abort(404, "Device not found.")
    except ValueError:
        abort(404, "Device not found.")
    if is_current:
        # The caller just signed out the device they're on — clear its cookies too.
        _clear_session_cookies()
        _clear_device_cookies()
    return "", 204


@auth_bp.delete("/devices")
@auth_bp.auth_required(bearer_auth)
@auth_bp.output(EmptySchema, status_code=204)
@auth_bp.doc(
    summary="Revoke (sign out) all devices except the current one.",
    operation_id="revokeOtherDevices",
    tags=["Auth"],
)
@limiter.limit("20 per minute")
def revoke_other_devices() -> tuple[str, int]:
    claims = cast(AccessClaims, bearer_auth.current_user)
    device_service.revoke_other_devices(
        user_id=claims.sub, current_device_id_token=_read_device_id_token()
    )
    return "", 204
