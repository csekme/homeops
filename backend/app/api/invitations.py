"""Top-level invitation endpoints: preview + accept (feature plan §Backend).

Both run cross-tenant (the invitee is not yet a member). Acceptance is authenticated and
auto-switches the caller into the joined household (returns a fresh access token, like
create/switch). The email-binding security check lives in ``invitation_service.accept``.
"""

from __future__ import annotations

from apiflask import APIBlueprint, abort
from apiflask.schemas import EmptySchema

from app.api.households import _abort_for, _claims, _switch_body
from app.api.schemas import (
    InvitationPreviewOut,
    InviteAcceptIn,
    InviteDeclineIn,
    MyInvitationListOut,
    SwitchOut,
)
from app.api.security import bearer_auth
from app.services import invitation_service
from app.services.exceptions import HouseholdError

invitations_bp = APIBlueprint("invitations", __name__, url_prefix="/api/invitations")


@invitations_bp.get("/<token>")
@invitations_bp.output(InvitationPreviewOut)
@invitations_bp.doc(
    summary="Preview a pending invitation (household + role).", operation_id="previewInvitation"
)
def preview(token: str) -> dict[str, object]:
    try:
        view = invitation_service.preview(raw_token=token)
    except HouseholdError as exc:
        _abort_for(exc)
    return {
        "household_name": view.household_name,
        "role": view.role,
        "email": view.email,
    }


@invitations_bp.get("/mine")
@invitations_bp.auth_required(bearer_auth)
@invitations_bp.output(MyInvitationListOut)
@invitations_bp.doc(
    summary="List the pending invitations addressed to the authenticated user.",
    operation_id="listMyInvitations",
)
def mine() -> dict[str, object]:
    views = invitation_service.list_mine(user_id=_claims().sub)
    return {
        "invitations": [
            {
                "id": v.id,
                "household_name": v.household_name,
                "role": v.role,
                "email": v.email,
                "expires_at": v.expires_at,
                "created_at": v.created_at,
            }
            for v in views
        ]
    }


@invitations_bp.post("/accept")
@invitations_bp.auth_required(bearer_auth)
@invitations_bp.input(InviteAcceptIn)
@invitations_bp.output(SwitchOut)
@invitations_bp.doc(
    summary="Accept an invitation (by token or id) and switch into the household.",
    operation_id="acceptInvitation",
)
def accept(json_data: dict) -> dict[str, object]:
    token = json_data.get("token")
    invitation_id = json_data.get("invitation_id")
    if not token and not invitation_id:
        abort(400, "Provide either a token or an invitation_id.")
    try:
        result = invitation_service.accept(
            user_id=_claims().sub, raw_token=token, invitation_id=invitation_id
        )
    except HouseholdError as exc:
        _abort_for(exc)
    return _switch_body(result)


@invitations_bp.post("/decline")
@invitations_bp.auth_required(bearer_auth)
@invitations_bp.input(InviteDeclineIn)
@invitations_bp.output(EmptySchema, status_code=204)
@invitations_bp.doc(
    summary="Decline a pending invitation addressed to the caller.",
    operation_id="declineInvitation",
)
def decline(json_data: dict) -> tuple[str, int]:
    token = json_data.get("token")
    invitation_id = json_data.get("invitation_id")
    if not token and not invitation_id:
        abort(400, "Provide either a token or an invitation_id.")
    try:
        invitation_service.decline(
            user_id=_claims().sub, raw_token=token, invitation_id=invitation_id
        )
    except HouseholdError as exc:
        _abort_for(exc)
    return "", 204
