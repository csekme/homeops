"""Top-level invitation endpoints: preview + accept (feature plan §Backend).

Both run cross-tenant (the invitee is not yet a member). Acceptance is authenticated and
auto-switches the caller into the joined household (returns a fresh access token, like
create/switch). The email-binding security check lives in ``invitation_service.accept``.
"""

from __future__ import annotations

from apiflask import APIBlueprint

from app.api.households import _abort_for, _claims, _switch_body
from app.api.schemas import InvitationPreviewOut, InviteAcceptIn, SwitchOut
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


@invitations_bp.post("/accept")
@invitations_bp.auth_required(bearer_auth)
@invitations_bp.input(InviteAcceptIn)
@invitations_bp.output(SwitchOut)
@invitations_bp.doc(
    summary="Accept an invitation and switch into the household.", operation_id="acceptInvitation"
)
def accept(json_data: dict) -> dict[str, object]:
    try:
        result = invitation_service.accept(user_id=_claims().sub, raw_token=json_data["token"])
    except HouseholdError as exc:
        _abort_for(exc)
    return _switch_body(result)
