"""Household management endpoints (feature plan §Backend).

Thin controllers: authenticate, enforce that tenant-scoped routes act on the *active*
household (path ``{id}`` must equal the JWT claim — so ``app.current_household`` is only
ever sourced from the token, keeping RLS a real second layer), delegate to the service, and
translate domain errors to HTTP. Create/switch run cross-household and return a fresh access
token (no refresh rotation → no Set-Cookie).
"""

from __future__ import annotations

from typing import NoReturn, cast

from apiflask import APIBlueprint, abort
from apiflask.schemas import EmptySchema

from app.api.schemas import (
    ChangeRoleIn,
    HouseholdCreateIn,
    HouseholdListOut,
    HouseholdOut,
    HouseholdRenameIn,
    InvitationListOut,
    InvitationOut,
    InviteCreateIn,
    MemberListOut,
    MemberOut,
    SwitchOut,
)
from app.api.security import bearer_auth
from app.security.jwt_tokens import AccessClaims
from app.services import household_service, invitation_service
from app.services.exceptions import (
    AlreadyMember,
    HouseholdError,
    HouseholdNotFound,
    InvalidInvitation,
    InvitationEmailMismatch,
    LastOwnerError,
    NotAMember,
    PendingInviteExists,
    PermissionDenied,
)
from app.services.household_service import SwitchResult

households_bp = APIBlueprint("households", __name__, url_prefix="/api/households")


def _claims() -> AccessClaims:
    return cast(AccessClaims, bearer_auth.current_user)


def _require_active(claims: AccessClaims, household_id: str) -> None:
    """Tenant-scoped routes may only touch the household the token is active in."""
    if claims.household_id is None or str(claims.household_id) != str(household_id):
        abort(409, "Switch to this household first.")


def _abort_for(exc: HouseholdError) -> NoReturn:
    if isinstance(exc, (NotAMember, HouseholdNotFound)):
        abort(404, "Household not found.")
    if isinstance(exc, (PermissionDenied, InvitationEmailMismatch)):
        abort(403, "You do not have permission to perform this action.")
    if isinstance(exc, (LastOwnerError, AlreadyMember, PendingInviteExists)):
        abort(409, str(exc))
    if isinstance(exc, InvalidInvitation):
        abort(400, "Invalid or expired invitation.")
    abort(400, "Request could not be processed.")  # pragma: no cover


def _switch_body(result: SwitchResult) -> dict[str, object]:
    return {
        "access_token": result.access_token,
        "token_type": "Bearer",  # nosec B105 — OAuth token type, not a secret
        "household": {
            "id": result.household.id,
            "name": result.household.name,
            "default_currency": result.household.default_currency,
            "role": result.household.role,
        },
    }


@households_bp.post("")
@households_bp.auth_required(bearer_auth)
@households_bp.input(HouseholdCreateIn)
@households_bp.output(SwitchOut, status_code=201)
@households_bp.doc(summary="Create a household and switch into it.", operation_id="createHousehold")
def create(json_data: dict) -> dict[str, object]:
    result = household_service.create(
        user_id=_claims().sub,
        name=json_data["name"],
        default_currency=json_data["default_currency"],
    )
    return _switch_body(result)


@households_bp.get("")
@households_bp.auth_required(bearer_auth)
@households_bp.output(HouseholdListOut)
@households_bp.doc(
    summary="List the households the caller belongs to.", operation_id="listHouseholds"
)
def list_households() -> dict[str, object]:
    households = household_service.list_for_user(user_id=_claims().sub)
    return {
        "households": [
            {
                "id": h.id,
                "name": h.name,
                "default_currency": h.default_currency,
                "role": h.role,
            }
            for h in households
        ]
    }


@households_bp.post("/<household_id>/switch")
@households_bp.auth_required(bearer_auth)
@households_bp.output(SwitchOut)
@households_bp.doc(
    summary="Switch the active household (re-mints the access token).",
    operation_id="switchHousehold",
)
def switch(household_id: str) -> dict[str, object]:
    try:
        result = household_service.switch(user_id=_claims().sub, household_id=household_id)
    except HouseholdError as exc:
        _abort_for(exc)
    return _switch_body(result)


@households_bp.patch("/<household_id>")
@households_bp.auth_required(bearer_auth)
@households_bp.input(HouseholdRenameIn)
@households_bp.output(HouseholdOut)
@households_bp.doc(summary="Rename a household.", operation_id="renameHousehold")
def rename(household_id: str, json_data: dict) -> dict[str, object]:
    claims = _claims()
    _require_active(claims, household_id)
    try:
        view = household_service.rename(
            user_id=claims.sub, household_id=household_id, name=json_data["name"]
        )
    except HouseholdError as exc:
        _abort_for(exc)
    return {
        "id": view.id,
        "name": view.name,
        "default_currency": view.default_currency,
        "role": view.role,
    }


@households_bp.delete("/<household_id>")
@households_bp.auth_required(bearer_auth)
@households_bp.output(EmptySchema, status_code=204)
@households_bp.doc(summary="Archive (soft-delete) a household.", operation_id="archiveHousehold")
def archive(household_id: str) -> tuple[str, int]:
    claims = _claims()
    _require_active(claims, household_id)
    try:
        household_service.archive(user_id=claims.sub, household_id=household_id)
    except HouseholdError as exc:
        _abort_for(exc)
    return "", 204


@households_bp.get("/<household_id>/members")
@households_bp.auth_required(bearer_auth)
@households_bp.output(MemberListOut)
@households_bp.doc(summary="List household members.", operation_id="listMembers")
def list_members(household_id: str) -> dict[str, object]:
    claims = _claims()
    _require_active(claims, household_id)
    try:
        members = household_service.list_members(user_id=claims.sub, household_id=household_id)
    except HouseholdError as exc:
        _abort_for(exc)
    return {
        "members": [
            {
                "membership_id": m.membership_id,
                "user_id": m.user_id,
                "email": m.email,
                "display_name": m.display_name,
                "role": m.role,
            }
            for m in members
        ]
    }


@households_bp.patch("/<household_id>/members/<user_id>")
@households_bp.auth_required(bearer_auth)
@households_bp.input(ChangeRoleIn)
@households_bp.output(MemberOut)
@households_bp.doc(summary="Change a member's role.", operation_id="changeMemberRole")
def change_role(household_id: str, user_id: str, json_data: dict) -> dict[str, object]:
    claims = _claims()
    _require_active(claims, household_id)
    try:
        member = household_service.change_role(
            actor_id=claims.sub,
            household_id=household_id,
            target_user_id=user_id,
            new_role=json_data["role"],
        )
    except HouseholdError as exc:
        _abort_for(exc)
    return {
        "membership_id": member.membership_id,
        "user_id": member.user_id,
        "email": member.email,
        "display_name": member.display_name,
        "role": member.role,
    }


@households_bp.delete("/<household_id>/members/<user_id>")
@households_bp.auth_required(bearer_auth)
@households_bp.output(EmptySchema, status_code=204)
@households_bp.doc(
    summary="Remove a member, or leave the household when removing yourself.",
    operation_id="removeMember",
)
def remove_member(household_id: str, user_id: str) -> tuple[str, int]:
    claims = _claims()
    _require_active(claims, household_id)
    try:
        if str(user_id) == str(claims.sub):
            household_service.leave(user_id=claims.sub, household_id=household_id)
        else:
            household_service.remove_member(
                actor_id=claims.sub, household_id=household_id, target_user_id=user_id
            )
    except HouseholdError as exc:
        _abort_for(exc)
    return "", 204


# ── Invitations nested under a household (create / list / resend / revoke) ─────────────


@households_bp.post("/<household_id>/invitations")
@households_bp.auth_required(bearer_auth)
@households_bp.input(InviteCreateIn)
@households_bp.output(InvitationOut, status_code=201)
@households_bp.doc(summary="Invite someone by email.", operation_id="createInvitation")
def create_invitation(household_id: str, json_data: dict) -> dict[str, object]:
    claims = _claims()
    _require_active(claims, household_id)
    try:
        view = invitation_service.invite(
            actor_id=claims.sub,
            household_id=household_id,
            email=json_data["email"],
            role=json_data["role"],
        )
    except HouseholdError as exc:
        _abort_for(exc)
    return _invitation_body(view)


@households_bp.get("/<household_id>/invitations")
@households_bp.auth_required(bearer_auth)
@households_bp.output(InvitationListOut)
@households_bp.doc(summary="List pending invitations.", operation_id="listInvitations")
def list_invitations(household_id: str) -> dict[str, object]:
    claims = _claims()
    _require_active(claims, household_id)
    try:
        views = invitation_service.list_pending(user_id=claims.sub, household_id=household_id)
    except HouseholdError as exc:
        _abort_for(exc)
    return {"invitations": [_invitation_body(v) for v in views]}


@households_bp.post("/<household_id>/invitations/<invitation_id>/resend")
@households_bp.auth_required(bearer_auth)
@households_bp.output(InvitationOut)
@households_bp.doc(summary="Re-send a pending invitation.", operation_id="resendInvitation")
def resend_invitation(household_id: str, invitation_id: str) -> dict[str, object]:
    claims = _claims()
    _require_active(claims, household_id)
    try:
        view = invitation_service.resend(
            actor_id=claims.sub, household_id=household_id, invitation_id=invitation_id
        )
    except HouseholdError as exc:
        _abort_for(exc)
    return _invitation_body(view)


@households_bp.delete("/<household_id>/invitations/<invitation_id>")
@households_bp.auth_required(bearer_auth)
@households_bp.output(EmptySchema, status_code=204)
@households_bp.doc(summary="Revoke a pending invitation.", operation_id="revokeInvitation")
def revoke_invitation(household_id: str, invitation_id: str) -> tuple[str, int]:
    claims = _claims()
    _require_active(claims, household_id)
    try:
        invitation_service.revoke(
            actor_id=claims.sub, household_id=household_id, invitation_id=invitation_id
        )
    except HouseholdError as exc:
        _abort_for(exc)
    return "", 204


def _invitation_body(view: invitation_service.InvitationView) -> dict[str, object]:
    return {
        "id": view.id,
        "email": view.email,
        "role": view.role,
        "expires_at": view.expires_at,
        "created_at": view.created_at,
    }
