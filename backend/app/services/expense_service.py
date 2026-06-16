"""Expense business logic + monthly overview (plan §4.5).

Every operation begins with ``require_permission`` (the RBAC gate, §4.2) and runs inside
the token's household context. Money stays in integer minor units end-to-end; the monthly
overview aggregates **per (currency, category)** and never sums across currencies — there
is no FX in Phase 1 (decision §10.1). Each per-currency total is wrapped in a :class:`Money`
value object, which structurally forbids cross-currency addition (defense-in-depth).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import Row

from app.db.models import Expense
from app.db.rls import session_scope
from app.domain.money import InvalidMoney, Money
from app.logging_config import get_logger
from app.repositories import expenses as expense_repo
from app.security.rbac import MembershipContext, require_permission
from app.services.exceptions import ExpenseNotFound, InvalidExpense

log = get_logger("homeops.expenses")

_UPDATABLE_FIELDS = frozenset(
    {"amount_minor", "currency", "occurred_on", "category", "service_id", "note", "is_recurring"}
)


def _validate_money(amount_minor: int, currency: str) -> None:
    """Reject a malformed amount/currency before it touches the DB (→ InvalidExpense)."""
    try:
        Money(amount_minor, currency)
    except InvalidMoney as exc:
        raise InvalidExpense(str(exc)) from exc


@dataclass(frozen=True)
class ExpenseData:
    amount_minor: int
    currency: str
    occurred_on: date
    category: str | None
    service_id: str | None
    note: str | None
    is_recurring: bool


@dataclass(frozen=True)
class ExpenseView:
    id: str
    amount_minor: int
    currency: str
    occurred_on: date
    category: str | None
    service_id: str | None
    note: str | None
    is_recurring: bool


@dataclass(frozen=True)
class CategoryLineView:
    category: str | None
    amount_minor: int
    count: int
    delta_minor: int  # month-over-month change vs the same (currency, category)


@dataclass(frozen=True)
class CurrencyGroupView:
    currency: str
    categories: list[CategoryLineView] = field(default_factory=list)
    fixed_total_minor: int = 0  # is_recurring = true
    variable_total_minor: int = 0  # is_recurring = false
    total_minor: int = 0
    delta_minor: int = 0  # month-over-month change of this currency's total


@dataclass(frozen=True)
class MonthlyOverviewView:
    year: int
    month: int
    currencies: list[CurrencyGroupView]


def _to_view(expense: Expense) -> ExpenseView:
    return ExpenseView(
        id=str(expense.id),
        amount_minor=expense.amount_minor,
        currency=expense.currency,
        occurred_on=expense.occurred_on,
        category=expense.category,
        service_id=str(expense.service_id) if expense.service_id else None,
        note=expense.note,
        is_recurring=expense.is_recurring,
    )


def create(membership: MembershipContext, data: ExpenseData) -> ExpenseView:
    require_permission(membership, "expense.write")
    # Validate the money shape up front (rejects float/bad currency) before persisting.
    _validate_money(data.amount_minor, data.currency)
    with session_scope(household_id=membership.household_id) as session:
        expense = expense_repo.create(
            session,
            household_id=membership.household_id,
            amount_minor=data.amount_minor,
            currency=data.currency,
            occurred_on=data.occurred_on,
            category=data.category,
            service_id=data.service_id,
            note=data.note,
            is_recurring=data.is_recurring,
        )
        log.info(
            "expense.created",
            household_id=membership.household_id,
            expense_id=str(expense.id),
        )
        return _to_view(expense)


def update(
    membership: MembershipContext, expense_id: str, changes: dict[str, object]
) -> ExpenseView:
    require_permission(membership, "expense.write")
    fields = {k: v for k, v in changes.items() if k in _UPDATABLE_FIELDS}
    with session_scope(household_id=membership.household_id) as session:
        expense = expense_repo.get(
            session, household_id=membership.household_id, expense_id=expense_id
        )
        if expense is None:
            raise ExpenseNotFound()
        # Re-validate money if either component changed.
        amount = fields.get("amount_minor", expense.amount_minor)
        currency = fields.get("currency", expense.currency)
        if isinstance(amount, int) and isinstance(currency, str):
            _validate_money(amount, currency)
        expense_repo.update(session, expense, **fields)
        log.info(
            "expense.updated", household_id=membership.household_id, expense_id=expense_id
        )
        return _to_view(expense)


def delete(membership: MembershipContext, expense_id: str) -> None:
    require_permission(membership, "expense.write")
    with session_scope(household_id=membership.household_id) as session:
        expense = expense_repo.get(
            session, household_id=membership.household_id, expense_id=expense_id
        )
        if expense is None:
            raise ExpenseNotFound()
        expense_repo.soft_delete(session, expense)
        log.info(
            "expense.deleted", household_id=membership.household_id, expense_id=expense_id
        )


def get(membership: MembershipContext, expense_id: str) -> ExpenseView:
    require_permission(membership, "expense.read")
    with session_scope(household_id=membership.household_id) as session:
        expense = expense_repo.get(
            session, household_id=membership.household_id, expense_id=expense_id
        )
        if expense is None:
            raise ExpenseNotFound()
        return _to_view(expense)


def list_expenses(
    membership: MembershipContext,
    *,
    year: int | None = None,
    month: int | None = None,
    category: str | None = None,
) -> list[ExpenseView]:
    require_permission(membership, "expense.read")
    with session_scope(household_id=membership.household_id) as session:
        rows = expense_repo.list_(
            session,
            household_id=membership.household_id,
            year=year,
            month=month,
            category=category,
        )
        return [_to_view(e) for e in rows]


def _prev_month(year: int, month: int) -> tuple[int, int]:
    return (year - 1, 12) if month == 1 else (year, month - 1)


def monthly_overview(
    membership: MembershipContext, *, year: int, month: int
) -> MonthlyOverviewView:
    """Per-(currency, category) totals with month-over-month deltas, fixed/variable split."""
    require_permission(membership, "expense.read")
    py, pm = _prev_month(year, month)
    with session_scope(household_id=membership.household_id) as session:
        current = expense_repo.monthly_summary(
            session, household_id=membership.household_id, year=year, month=month
        )
        previous = expense_repo.monthly_summary(
            session, household_id=membership.household_id, year=py, month=pm
        )
    return _build_overview(year, month, current, previous)


_SummaryRow = Row[tuple[str, str | None, bool, int, int]]


def _build_overview(
    year: int,
    month: int,
    current: list[_SummaryRow],
    previous: list[_SummaryRow],
) -> MonthlyOverviewView:
    # Previous month, keyed for delta lookup: per (currency, category) and per currency.
    prev_cat: dict[tuple[str, str | None], int] = {}
    prev_cur: dict[str, int] = {}
    for currency, category, _recurring, total, _count in previous:
        prev_cat[(currency, category)] = prev_cat.get((currency, category), 0) + int(total)
        prev_cur[currency] = prev_cur.get(currency, 0) + int(total)

    # Current month, accumulated per currency (Money forbids cross-currency addition).
    cat_amount: dict[tuple[str, str | None], Money] = {}
    cat_count: dict[tuple[str, str | None], int] = {}
    fixed: dict[str, Money] = {}
    variable: dict[str, Money] = {}
    for currency, category, recurring, total, count in current:
        if currency not in fixed:
            fixed[currency] = Money(0, currency)
            variable[currency] = Money(0, currency)
        money = Money(int(total), currency)
        key = (currency, category)
        cat_amount[key] = cat_amount.get(key, Money(0, currency)).add(money)
        cat_count[key] = cat_count.get(key, 0) + int(count)
        if recurring:
            fixed[currency] = fixed[currency].add(money)
        else:
            variable[currency] = variable[currency].add(money)

    groups: list[CurrencyGroupView] = []
    for currency in sorted(fixed):
        categories = sorted(
            (key[1] for key in cat_amount if key[0] == currency),
            key=lambda c: (c is not None, c or ""),
        )
        lines = [
            CategoryLineView(
                category=category,
                amount_minor=cat_amount[(currency, category)].amount_minor,
                count=cat_count[(currency, category)],
                delta_minor=cat_amount[(currency, category)].amount_minor
                - prev_cat.get((currency, category), 0),
            )
            for category in categories
        ]
        total_money = fixed[currency].add(variable[currency])
        groups.append(
            CurrencyGroupView(
                currency=currency,
                categories=lines,
                fixed_total_minor=fixed[currency].amount_minor,
                variable_total_minor=variable[currency].amount_minor,
                total_minor=total_money.amount_minor,
                delta_minor=total_money.amount_minor - prev_cur.get(currency, 0),
            )
        )

    return MonthlyOverviewView(year=year, month=month, currencies=groups)
