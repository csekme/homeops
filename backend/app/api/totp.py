"""Two-factor (TOTP) endpoints (feature plan §Backend.9).

Thin controllers: validate input, delegate to ``totp_service`` / ``auth_service``, map
domain errors to HTTP. All but ``/verify`` require a valid access token; ``/verify`` is the
login step-2 exchange and carries the challenge token in its body. Code-entry endpoints are
rate-limited and answer with generic errors (no enumeration, feature plan §Security).
"""

from __future__ import annotations

from typing import cast

from apiflask import APIBlueprint, abort
from apiflask.schemas import EmptySchema
from flask import request

from app.api.auth import issue_session_response
from app.api.schemas import (
    LoginOut,
    RecoveryCodesOut,
    RecoveryRegenerateIn,
    TotpConfirmIn,
    TotpDisableIn,
    TotpSetupOut,
    TotpStatusOut,
    TotpVerifyIn,
)
from app.api.security import bearer_auth
from app.extensions import limiter
from app.security.jwt_tokens import AccessClaims, TokenError
from app.services import auth_service, totp_service
from app.services.exceptions import (
    InvalidCredentials,
    InvalidTotpCode,
    TotpAlreadyEnabled,
    TotpNotConfigured,
    TotpReuse,
)

totp_bp = APIBlueprint("totp", __name__, url_prefix="/api/auth/totp")


def _current_user_id() -> str:
    # @auth_required guarantees current_user is populated.
    return cast(AccessClaims, bearer_auth.current_user).sub


@totp_bp.post("/setup")
@totp_bp.auth_required(bearer_auth)
@totp_bp.output(TotpSetupOut)
@totp_bp.doc(
    summary="Begin 2FA enrolment; returns the otpauth URI + base32 secret.",
    operation_id="totpSetup",
    tags=["Auth"],
)
@limiter.limit("10 per minute")
def setup() -> dict[str, str]:
    try:
        view = totp_service.start_setup(user_id=_current_user_id())
    except TotpAlreadyEnabled:
        abort(409, "Two-factor authentication is already enabled.")
    return {"provisioning_uri": view.provisioning_uri, "secret": view.secret}


@totp_bp.post("/confirm")
@totp_bp.auth_required(bearer_auth)
@totp_bp.input(TotpConfirmIn)
@totp_bp.output(RecoveryCodesOut)
@totp_bp.doc(
    summary="Confirm enrolment with a code; returns the one-time recovery codes.",
    operation_id="totpConfirm",
    tags=["Auth"],
)
@limiter.limit("10 per minute")
def confirm(json_data: dict) -> dict[str, list[str]]:
    try:
        codes = totp_service.confirm_setup(user_id=_current_user_id(), code=json_data["code"])
    except TotpAlreadyEnabled:
        abort(409, "Two-factor authentication is already enabled.")
    except TotpNotConfigured:
        abort(400, "Start two-factor setup first.")
    except InvalidTotpCode:
        abort(400, "Invalid code.")
    return {"codes": codes}


@totp_bp.post("/disable")
@totp_bp.auth_required(bearer_auth)
@totp_bp.input(TotpDisableIn)
@totp_bp.output(EmptySchema, status_code=204)
@totp_bp.doc(
    summary="Disable 2FA (re-verifies the password).", operation_id="totpDisable", tags=["Auth"]
)
@limiter.limit("10 per minute")
def disable(json_data: dict) -> tuple[str, int]:
    try:
        totp_service.disable(user_id=_current_user_id(), password=json_data["password"])
    except InvalidCredentials:
        abort(401, "Invalid password.")
    except TotpNotConfigured:
        abort(400, "Two-factor authentication is not enabled.")
    return "", 204


@totp_bp.post("/recovery/regenerate")
@totp_bp.auth_required(bearer_auth)
@totp_bp.input(RecoveryRegenerateIn)
@totp_bp.output(RecoveryCodesOut)
@totp_bp.doc(
    summary="Regenerate recovery codes (re-verifies the password).",
    operation_id="totpRegenerateRecovery",
    tags=["Auth"],
)
@limiter.limit("10 per minute")
def regenerate_recovery(json_data: dict) -> dict[str, list[str]]:
    try:
        codes = totp_service.regenerate_recovery(
            user_id=_current_user_id(), password=json_data["password"]
        )
    except InvalidCredentials:
        abort(401, "Invalid password.")
    except TotpNotConfigured:
        abort(400, "Two-factor authentication is not enabled.")
    return {"codes": codes}


@totp_bp.get("/status")
@totp_bp.auth_required(bearer_auth)
@totp_bp.output(TotpStatusOut)
@totp_bp.doc(
    summary="Whether 2FA is enabled + remaining recovery codes.",
    operation_id="totpStatus",
    tags=["Auth"],
)
def status() -> dict[str, object]:
    view = totp_service.status(user_id=_current_user_id())
    return {"enabled": view.enabled, "recovery_codes_remaining": view.recovery_codes_remaining}


@totp_bp.post("/verify")
@totp_bp.input(TotpVerifyIn)
@totp_bp.output(LoginOut)
@totp_bp.doc(
    summary="Login step 2: exchange challenge token + code for a session.",
    operation_id="totpVerify",
    tags=["Auth"],
)
@limiter.limit("10 per minute")
def verify(json_data: dict) -> dict[str, object]:
    try:
        issued = auth_service.complete_login(
            challenge_token=json_data["challenge_token"],
            code=json_data["code"],
            ip=request.remote_addr,
            user_agent=request.headers.get("User-Agent"),
        )
    except (TokenError, InvalidCredentials, InvalidTotpCode, TotpReuse, TotpNotConfigured):
        # Generic for all step-2 failures (no enumeration; expired challenge → re-login).
        abort(401, "Invalid or expired verification.")
    return issue_session_response(issued)
