"""Dashboard endpoint (plan §4.6).

Thin controller: resolve the tenant context from the token, delegate to
``dashboard_service``, and serialize. Financial blocks are dropped from the JSON when the
service returns them as ``None`` (a role without ``expense.read``) — the server half of the
two-layer financial visibility rule."""

from __future__ import annotations

from apiflask import APIBlueprint

from app.api.schemas import DashboardOut
from app.api.security import bearer_auth, current_membership
from app.services import dashboard_service

dashboard_bp = APIBlueprint("dashboard", __name__, url_prefix="/api")


@dashboard_bp.get("/dashboard")
@dashboard_bp.auth_required(bearer_auth)
@dashboard_bp.output(DashboardOut)
@dashboard_bp.doc(summary="Role-sensitive dashboard aggregate.", tags=["Dashboard"])
def get_dashboard() -> dict:
    view = dashboard_service.build_dashboard(current_membership())
    data: dict = {
        "upcoming_obligations": view.upcoming_obligations,
        "overdue_obligations": view.overdue_obligations,
        "alerts": view.alerts,
    }
    # Only present for roles with expense.read — absent (not null) otherwise.
    if view.monthly_overview is not None:
        data["monthly_overview"] = view.monthly_overview
    if view.due_payments is not None:
        data["due_payments"] = view.due_payments
    return data
