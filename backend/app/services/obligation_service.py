"""Obligation business logic (plan §4.4).

One-off and recurring (RRULE) household tasks with an optional assignee. Every tenant
operation begins with ``require_permission`` (the RBAC gate, §4.2) and runs inside the
token's household context (``session_scope(household_id=...)``) — never a body-supplied id.

Two derivations live here, not in the DB:
- **Display status** — DUE/OVERDUE are computed at read time from ``due_date`` +
  ``lead_time_days`` via :func:`derive_status`; only UPCOMING/DONE/SKIPPED are stored.
- **Next occurrence** — completing/skipping a recurring obligation spawns the next row
  (``next_occurrence``); a rule with no further occurrences simply spawns nothing.

CHILD scope is enforced **server-side**: a CHILD only ever lists the obligations assigned
to them — never a UI-only filter (plan §4.4 acceptance).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

from sqlalchemy.orm import Session

from app.db.models import Obligation
from app.db.rls import session_scope
from app.domain.enums import ObligationStatus
from app.domain.enums import Role as RoleEnum
from app.domain.recurrence import RecurrenceError, derive_status, next_occurrence
from app.logging_config import get_logger
from app.repositories import memberships as membership_repo
from app.repositories import obligations as obligation_repo
from app.security.rbac import MembershipContext, require_permission
from app.services.exceptions import InvalidObligation, ObligationNotFound

log = get_logger("homeops.obligations")

# Fields a partial update (PATCH) may set. Guards against mass-assignment of internal
# columns (status, completed_at, household_id, deleted_at) — those move only via the
# dedicated complete/skip/delete flows.
_UPDATABLE_FIELDS = frozenset(
    {
        "title",
        "description",
        "category",
        "due_date",
        "rrule",
        "assignee_membership_id",
        "estimated_amount_minor",
        "actual_amount_minor",
        "currency",
        "lead_time_days",
    }
)


@dataclass(frozen=True)
class ObligationData:
    """Validated create payload (all fields present; optionals as ``None``)."""

    title: str
    description: str | None
    category: str | None
    due_date: date
    rrule: str | None
    assignee_membership_id: str | None
    estimated_amount_minor: int | None
    actual_amount_minor: int | None
    currency: str | None
    lead_time_days: int


@dataclass(frozen=True)
class ObligationView:
    id: str
    title: str
    description: str | None
    category: str | None
    due_date: date
    rrule: str | None
    status: str  # derived display status (DUE/OVERDUE computed; DONE/SKIPPED terminal)
    assignee_membership_id: str | None
    estimated_amount_minor: int | None
    actual_amount_minor: int | None
    currency: str | None
    lead_time_days: int
    completed_at: datetime | None


def _today() -> date:
    return datetime.now(UTC).date()


def _normalize_rrule(rrule: str | None) -> str | None:
    """Empty/whitespace RRULE means *no recurrence*; a non-empty one must parse."""
    if rrule is None or rrule.strip() == "":
        return None
    try:
        # Probe-parse against an arbitrary anchor — we only care that it is well-formed.
        next_occurrence(rrule, _today())
    except RecurrenceError as exc:
        raise InvalidObligation(str(exc)) from exc
    return rrule.strip()


def _to_view(obligation: Obligation, today: date) -> ObligationView:
    derived = derive_status(
        obligation.due_date,
        ObligationStatus(obligation.status),
        today,
        obligation.lead_time_days,
    )
    return ObligationView(
        id=str(obligation.id),
        title=obligation.title,
        description=obligation.description,
        category=obligation.category,
        due_date=obligation.due_date,
        rrule=obligation.rrule,
        status=derived.value,
        assignee_membership_id=(
            str(obligation.assignee_membership_id)
            if obligation.assignee_membership_id
            else None
        ),
        estimated_amount_minor=obligation.estimated_amount_minor,
        actual_amount_minor=obligation.actual_amount_minor,
        currency=obligation.currency,
        lead_time_days=obligation.lead_time_days,
        completed_at=obligation.completed_at,
    )


def _own_membership_id(session: Session, membership: MembershipContext) -> str | None:
    row = membership_repo.get_for_user_household(
        session, user_id=membership.user_id, household_id=membership.household_id
    )
    return str(row.id) if row is not None else None


def create(membership: MembershipContext, data: ObligationData) -> ObligationView:
    require_permission(membership, "obligation.write")
    rrule = _normalize_rrule(data.rrule)
    with session_scope(household_id=membership.household_id) as session:
        obligation = obligation_repo.create(
            session,
            household_id=membership.household_id,
            title=data.title.strip(),
            description=data.description,
            category=data.category,
            due_date=data.due_date,
            rrule=rrule,
            status=ObligationStatus.UPCOMING.value,
            assignee_membership_id=data.assignee_membership_id,
            estimated_amount_minor=data.estimated_amount_minor,
            actual_amount_minor=data.actual_amount_minor,
            currency=data.currency,
            lead_time_days=data.lead_time_days,
        )
        log.info(
            "obligation.created",
            household_id=membership.household_id,
            obligation_id=str(obligation.id),
            recurring=rrule is not None,
        )
        return _to_view(obligation, _today())


def update(
    membership: MembershipContext, obligation_id: str, changes: dict[str, object]
) -> ObligationView:
    require_permission(membership, "obligation.write")
    fields = {k: v for k, v in changes.items() if k in _UPDATABLE_FIELDS}
    if "rrule" in fields:
        rrule = fields["rrule"]
        fields["rrule"] = _normalize_rrule(rrule if isinstance(rrule, str) else None)
    if "title" in fields and isinstance(fields["title"], str):
        fields["title"] = fields["title"].strip()
    with session_scope(household_id=membership.household_id) as session:
        obligation = obligation_repo.get(
            session, household_id=membership.household_id, obligation_id=obligation_id
        )
        if obligation is None:
            raise ObligationNotFound()
        obligation_repo.update(session, obligation, **fields)
        log.info(
            "obligation.updated",
            household_id=membership.household_id,
            obligation_id=obligation_id,
        )
        return _to_view(obligation, _today())


def delete(membership: MembershipContext, obligation_id: str) -> None:
    require_permission(membership, "obligation.write")
    with session_scope(household_id=membership.household_id) as session:
        obligation = obligation_repo.get(
            session, household_id=membership.household_id, obligation_id=obligation_id
        )
        if obligation is None:
            raise ObligationNotFound()
        obligation_repo.soft_delete(session, obligation)
        log.info(
            "obligation.deleted",
            household_id=membership.household_id,
            obligation_id=obligation_id,
        )


def list_obligations(
    membership: MembershipContext,
    *,
    status: str | None = None,
    assignee_membership_id: str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
) -> list[ObligationView]:
    require_permission(membership, "obligation.read")
    today = _today()
    with session_scope(household_id=membership.household_id) as session:
        # CHILD only ever sees what's assigned to them — enforced here, not in the UI.
        if membership.role is RoleEnum.CHILD:
            own = _own_membership_id(session, membership)
            if own is None:  # pragma: no cover — a CHILD always has a membership row
                return []
            assignee_membership_id = own
        rows = obligation_repo.list_(
            session,
            household_id=membership.household_id,
            status=status,
            assignee_membership_id=assignee_membership_id,
            due_from=due_from,
            due_to=due_to,
        )
        return [_to_view(o, today) for o in rows]


def get(membership: MembershipContext, obligation_id: str) -> ObligationView:
    require_permission(membership, "obligation.read")
    with session_scope(household_id=membership.household_id) as session:
        obligation = obligation_repo.get(
            session, household_id=membership.household_id, obligation_id=obligation_id
        )
        if obligation is None:
            raise ObligationNotFound()
        # A CHILD may only see their own assignments (mirrors the list scope).
        if membership.role is RoleEnum.CHILD:
            own = _own_membership_id(session, membership)
            if str(obligation.assignee_membership_id) != own:
                raise ObligationNotFound()
        return _to_view(obligation, _today())


def complete(membership: MembershipContext, obligation_id: str) -> ObligationView:
    """Mark DONE; for a recurring obligation, spawn the next occurrence."""
    return _advance(membership, obligation_id, ObligationStatus.DONE, set_completed=True)


def skip(membership: MembershipContext, obligation_id: str) -> ObligationView:
    """Mark SKIPPED; for a recurring obligation, spawn the next occurrence."""
    return _advance(membership, obligation_id, ObligationStatus.SKIPPED, set_completed=False)


def _advance(
    membership: MembershipContext,
    obligation_id: str,
    terminal: ObligationStatus,
    *,
    set_completed: bool,
) -> ObligationView:
    require_permission(membership, "obligation.write")
    with session_scope(household_id=membership.household_id) as session:
        obligation = obligation_repo.get(
            session, household_id=membership.household_id, obligation_id=obligation_id
        )
        if obligation is None:
            raise ObligationNotFound()

        obligation_repo.update(
            session,
            obligation,
            status=terminal.value,
            completed_at=datetime.now(UTC) if set_completed else None,
        )

        if obligation.rrule:
            nxt = next_occurrence(obligation.rrule, obligation.due_date)
            if nxt is not None:
                obligation_repo.create(
                    session,
                    household_id=membership.household_id,
                    title=obligation.title,
                    description=obligation.description,
                    category=obligation.category,
                    due_date=nxt,
                    rrule=obligation.rrule,
                    status=ObligationStatus.UPCOMING.value,
                    assignee_membership_id=obligation.assignee_membership_id,
                    estimated_amount_minor=obligation.estimated_amount_minor,
                    actual_amount_minor=obligation.actual_amount_minor,
                    currency=obligation.currency,
                    lead_time_days=obligation.lead_time_days,
                )

        log.info(
            "obligation.advanced",
            household_id=membership.household_id,
            obligation_id=obligation_id,
            status=terminal.value,
        )
        return _to_view(obligation, _today())
