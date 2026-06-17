"""Notification preference endpoints (plan §4.7, §4.13 web counterpart).

A member manages **their own** delivery preferences in the active household. No dedicated
RBAC permission: the tenant context (token household + user) is the whole authorization.
Thin controller → ``notification_service``."""

from __future__ import annotations

from apiflask import APIBlueprint

from app.api.schemas import NotificationPreferenceIn, NotificationPreferenceOut
from app.api.security import bearer_auth, current_membership
from app.services import notification_service

notifications_bp = APIBlueprint("notifications", __name__, url_prefix="/api")


@notifications_bp.get("/notification-preferences")
@notifications_bp.auth_required(bearer_auth)
@notifications_bp.output(NotificationPreferenceOut(many=True))
@notifications_bp.doc(summary="List the caller's notification preferences.", tags=["Notifications"])
def list_preferences() -> list:
    return notification_service.list_preferences(current_membership())


@notifications_bp.put("/notification-preferences")
@notifications_bp.auth_required(bearer_auth)
@notifications_bp.input(NotificationPreferenceIn)
@notifications_bp.output(NotificationPreferenceOut)
@notifications_bp.doc(
    summary="Create or update one (type, channel) preference.", tags=["Notifications"]
)
def set_preference(json_data: dict):
    return notification_service.set_preference(
        current_membership(),
        type=json_data["type"],
        channel=json_data["channel"],
        enabled=json_data["enabled"],
        lead_times=json_data["lead_times"],
    )
