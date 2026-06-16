"""Expense data access (plan §4.5).

Explicit ``household_id`` filtering is kept as defense-in-depth alongside RLS. Soft-deleted
rows are excluded from every read. The monthly overview is built from a SQL aggregation
(``GROUP BY currency, category, is_recurring``) so totals never round-trip whole rows.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import Row, func, select
from sqlalchemy.orm import Session

from app.db.models import Expense


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    """Half-open ``[start, end)`` range for the calendar month (sargable on the index)."""
    start = date(year, month, 1)
    end = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    return start, end


def create(
    session: Session,
    *,
    household_id: uuid.UUID | str,
    amount_minor: int,
    currency: str,
    occurred_on: date,
    category: str | None,
    service_id: uuid.UUID | str | None,
    note: str | None,
    is_recurring: bool,
) -> Expense:
    expense = Expense(
        household_id=uuid.UUID(str(household_id)),
        amount_minor=amount_minor,
        currency=currency,
        occurred_on=occurred_on,
        category=category,
        service_id=uuid.UUID(str(service_id)) if service_id else None,
        note=note,
        is_recurring=is_recurring,
    )
    session.add(expense)
    session.flush()
    return expense


def get(
    session: Session, *, household_id: uuid.UUID | str, expense_id: uuid.UUID | str
) -> Expense | None:
    return session.execute(
        select(Expense).where(
            Expense.id == uuid.UUID(str(expense_id)),
            Expense.household_id == uuid.UUID(str(household_id)),
            Expense.deleted_at.is_(None),
        )
    ).scalar_one_or_none()


def list_(
    session: Session,
    *,
    household_id: uuid.UUID | str,
    year: int | None = None,
    month: int | None = None,
    category: str | None = None,
) -> list[Expense]:
    stmt = (
        select(Expense)
        .where(
            Expense.household_id == uuid.UUID(str(household_id)),
            Expense.deleted_at.is_(None),
        )
        .order_by(Expense.occurred_on.desc(), Expense.created_at.desc())
    )
    if year is not None and month is not None:
        start, end = _month_bounds(year, month)
        stmt = stmt.where(Expense.occurred_on >= start, Expense.occurred_on < end)
    if category is not None:
        stmt = stmt.where(Expense.category == category)
    return list(session.execute(stmt).scalars().all())


def monthly_summary(
    session: Session, *, household_id: uuid.UUID | str, year: int, month: int
) -> list[Row[tuple[str, str | None, bool, int, int]]]:
    """Aggregate one month ``GROUP BY currency, category, is_recurring``.

    Returns rows of ``(currency, category, is_recurring, total_minor, count)``. Splitting
    on ``is_recurring`` lets the service derive fixed vs variable totals without a second
    query; currencies stay separate so nothing is ever summed across them.
    """
    start, end = _month_bounds(year, month)
    stmt = (
        select(
            Expense.currency,
            Expense.category,
            Expense.is_recurring,
            func.sum(Expense.amount_minor),
            func.count(),
        )
        .where(
            Expense.household_id == uuid.UUID(str(household_id)),
            Expense.deleted_at.is_(None),
            Expense.occurred_on >= start,
            Expense.occurred_on < end,
        )
        .group_by(Expense.currency, Expense.category, Expense.is_recurring)
    )
    return list(session.execute(stmt).all())


def update(session: Session, expense: Expense, **fields: object) -> None:
    for key, value in fields.items():
        setattr(expense, key, value)
    session.flush()


def soft_delete(session: Session, expense: Expense) -> None:
    expense.deleted_at = datetime.now(UTC)
