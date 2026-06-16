"""Role-sensitive dashboard aggregation (plan §4.6).

A single read that composes the existing tenant services — it adds no new persistence, it
*reuses* ``obligation_service`` and ``expense_service`` so business rules (CHILD scope,
derived status, per-currency money) live in exactly one place.

**Two-layer financial visibility (plan §4.6, §12):** the financial blocks (monthly
spend, due payments) are omitted from the payload entirely for roles without
``expense.read`` — this is the server half; the client gates the same widgets with
``isFinancialVisible``. The fields come back as ``None`` (and the controller drops them
from the JSON), never merely hidden in the UI.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from app.domain.enums import ObligationStatus
from app.security.rbac import MembershipContext, has_permission, resolve_permissions
from app.services import expense_service, obligation_service
from app.services.expense_service import MonthlyOverviewView
from app.services.obligation_service import ObligationView

# How far ahead/back the obligation widgets reach. The lookback bounds the overdue list to
# an index-friendly range instead of scanning the whole table's history.
_HORIZON_DAYS = 30
_LOOKBACK_DAYS = 90

_TERMINAL = {ObligationStatus.DONE.value, ObligationStatus.SKIPPED.value}
_DUE_OR_OVERDUE = {ObligationStatus.DUE.value, ObligationStatus.OVERDUE.value}


@dataclass(frozen=True)
class DashboardView:
    # All roles.
    upcoming_obligations: list[ObligationView]
    overdue_obligations: list[ObligationView]
    alerts: list[dict[str, object]]  # active-alert seam — populated once the 4.7 outbox lands.
    # Financial — None (and dropped from the response) for roles without expense.read.
    monthly_overview: MonthlyOverviewView | None
    due_payments: list[ObligationView] | None


def build_dashboard(membership: MembershipContext) -> DashboardView:
    today = datetime.now(UTC).date()

    # One windowed obligation read (index-friendly), split by derived status. CHILD scope
    # and status derivation are applied inside the service, not duplicated here.
    window = obligation_service.list_obligations(
        membership,
        due_from=today - timedelta(days=_LOOKBACK_DAYS),
        due_to=today + timedelta(days=_HORIZON_DAYS),
    )
    upcoming = [o for o in window if o.status not in _TERMINAL and o.due_date >= today]
    overdue = [o for o in window if o.status == ObligationStatus.OVERDUE.value]

    monthly_overview: MonthlyOverviewView | None = None
    due_payments: list[ObligationView] | None = None
    if has_permission(resolve_permissions(membership.role), "expense.read"):
        monthly_overview = expense_service.monthly_overview(
            membership, year=today.year, month=today.month
        )
        # Money-bearing obligations that are due or overdue — the "esedékes befizetések".
        due_payments = [
            o
            for o in window
            if o.estimated_amount_minor is not None and o.status in _DUE_OR_OVERDUE
        ]

    return DashboardView(
        upcoming_obligations=upcoming,
        overdue_obligations=overdue,
        alerts=[],
        monthly_overview=monthly_overview,
        due_payments=due_payments,
    )
