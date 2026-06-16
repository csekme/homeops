"""Household, membership and invitation endpoints (plan §4.3).

Thin controllers: validate input, resolve the tenant context from the token via
``current_membership`` (never the body), delegate to ``household_service``, and translate
domain errors to HTTP. The RBAC gate lives in the service; ``PermissionDenied`` maps to
403 centrally (``errors.py``)."""

from __future__ import annotations

from typing import cast

from apiflask import APIBlueprint, abort
from apiflask.schemas import EmptySchema

from app.api.schemas import (
    AcceptInviteIn,
    HouseholdIn,
    HouseholdOut,
    InviteIn,
    MemberOut,
    MemberRoleIn,
    MessageOut,
    SwitchHouseholdIn,
    SwitchHouseholdOut,
)
from app.api.security import bearer_auth, current_membership
from app.domain.enums import Role as RoleEnum
from app.security.jwt_tokens import AccessClaims
from app.services import household_service
from app.services.exceptions import (
    AlreadyMember,
    HouseholdNotFound,
    InvalidInvitation,
    LastOwnerProtected,
    MemberNotFound,
)

households_bp = APIBlueprint("households", __name__, url_prefix="/api")


def _user_id() -> str:
    """Authenticated user id from the verified token (no household context required)."""
    return cast(AccessClaims, bearer_auth.current_user).sub


# ── User-scoped: no active household required ─────────────────────────────────────────


@households_bp.post("/households")
@households_bp.auth_required(bearer_auth)
@households_bp.input(HouseholdIn)
@households_bp.output(HouseholdOut, status_code=201)
@households_bp.doc(summary="Create a household (creator becomes OWNER).", tags=["Households"])
def create_household(json_data: dict) -> dict:
    view = household_service.create_household(
        user_id=_user_id(),
        name=json_data["name"],
        default_currency=json_data["default_currency"],
    )
    return _household_dict(view)


@households_bp.get("/households")
@households_bp.auth_required(bearer_auth)
@households_bp.output(HouseholdOut(many=True))
@households_bp.doc(summary="List the households the user belongs to.", tags=["Households"])
def list_households() -> list[dict]:
    return [_household_dict(v) for v in household_service.list_households(user_id=_user_id())]


@households_bp.post("/households/switch")
@households_bp.auth_required(bearer_auth)
@households_bp.input(SwitchHouseholdIn)
@households_bp.output(SwitchHouseholdOut)
@households_bp.doc(
    summary="Switch active household; returns a new access token.", tags=["Households"]
)
def switch_household(json_data: dict) -> dict:
    try:
        result = household_service.switch_household(
            user_id=_user_id(), household_id=json_data["household_id"]
        )
    except HouseholdNotFound:
        abort(404, "Household not found.")
    return {
        "access_token": result.access_token,
        "token_type": "Bearer",  # nosec B105 — OAuth token type, not a secret
        "household_id": result.household_id,
        "role": result.role,
    }


@households_bp.post("/invitations/accept")
@households_bp.auth_required(bearer_auth)
@households_bp.input(AcceptInviteIn)
@households_bp.output(MessageOut)
@households_bp.doc(summary="Accept an invitation and join the household.", tags=["Households"])
def accept_invitation(json_data: dict) -> dict:
    try:
        household_service.accept_invitation(user_id=_user_id(), raw_token=json_data["token"])
    except InvalidInvitation:
        abort(400, "Invalid or expired invitation.")
    except AlreadyMember:
        abort(409, "You already belong to this household.")
    return {"message": "Invitation accepted."}


# ── Household-scoped: act inside the token's household (RBAC-gated in the service) ─────


@households_bp.post("/invitations")
@households_bp.auth_required(bearer_auth)
@households_bp.input(InviteIn)
@households_bp.output(MessageOut, status_code=202)
@households_bp.doc(summary="Invite someone to the active household by email.", tags=["Households"])
def create_invitation(json_data: dict) -> dict:
    household_service.invite(
        membership=current_membership(),
        email=json_data["email"],
        role=RoleEnum(json_data["role"]),
    )
    return {"message": "Invitation sent."}


@households_bp.get("/households/<household_id>/members")
@households_bp.auth_required(bearer_auth)
@households_bp.output(MemberOut(many=True))
@households_bp.doc(summary="List members of the active household.", tags=["Households"])
def list_members(household_id: str) -> list[dict]:
    try:
        members = household_service.list_members(
            membership=current_membership(), household_id=household_id
        )
    except HouseholdNotFound:
        abort(404, "Household not found.")
    return [_member_dict(m) for m in members]


@households_bp.patch("/households/<household_id>/members/<membership_id>")
@households_bp.auth_required(bearer_auth)
@households_bp.input(MemberRoleIn)
@households_bp.output(MemberOut)
@households_bp.doc(summary="Change a member's role.", tags=["Households"])
def update_member_role(household_id: str, membership_id: str, json_data: dict) -> dict:
    try:
        member = household_service.update_member_role(
            membership=current_membership(),
            household_id=household_id,
            target_membership_id=membership_id,
            role=RoleEnum(json_data["role"]),
        )
    except HouseholdNotFound:
        abort(404, "Household not found.")
    except MemberNotFound:
        abort(404, "Member not found.")
    except LastOwnerProtected:
        abort(409, "A household must keep at least one owner.")
    return _member_dict(member)


@households_bp.delete("/households/<household_id>/members/<membership_id>")
@households_bp.auth_required(bearer_auth)
@households_bp.output(EmptySchema, status_code=204)
@households_bp.doc(summary="Remove a member from the household.", tags=["Households"])
def remove_member(household_id: str, membership_id: str) -> tuple[str, int]:
    try:
        household_service.remove_member(
            membership=current_membership(),
            household_id=household_id,
            target_membership_id=membership_id,
        )
    except HouseholdNotFound:
        abort(404, "Household not found.")
    except MemberNotFound:
        abort(404, "Member not found.")
    except LastOwnerProtected:
        abort(409, "A household must keep at least one owner.")
    return "", 204


@households_bp.delete("/households/<household_id>")
@households_bp.auth_required(bearer_auth)
@households_bp.output(EmptySchema, status_code=204)
@households_bp.doc(summary="Soft-delete a household (OWNER only).", tags=["Households"])
def delete_household(household_id: str) -> tuple[str, int]:
    try:
        household_service.delete_household(
            membership=current_membership(), household_id=household_id
        )
    except HouseholdNotFound:
        abort(404, "Household not found.")
    return "", 204


def _household_dict(view: household_service.HouseholdView) -> dict:
    return {
        "id": view.id,
        "name": view.name,
        "default_currency": view.default_currency,
        "role": view.role,
    }


def _member_dict(view: household_service.MemberView) -> dict:
    return {
        "membership_id": view.membership_id,
        "user_id": view.user_id,
        "email": view.email,
        "display_name": view.display_name,
        "role": view.role,
    }
