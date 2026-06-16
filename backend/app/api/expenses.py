"""Expense + monthly-overview endpoints (plan §4.5).

Thin controllers: validate input, resolve the tenant context from the token via
``current_membership`` (never the body), delegate to ``expense_service``, and translate
domain errors to HTTP. The RBAC gate lives in the service; ``PermissionDenied`` maps to
403 centrally (``errors.py``)."""

from __future__ import annotations

from apiflask import APIBlueprint, abort
from apiflask.schemas import EmptySchema

from app.api.schemas import (
    ExpenseIn,
    ExpenseListQuery,
    ExpenseOut,
    MonthlyOverviewOut,
    MonthlyOverviewQuery,
)
from app.api.security import bearer_auth, current_membership
from app.services import expense_service
from app.services.exceptions import ExpenseNotFound, InvalidExpense
from app.services.expense_service import ExpenseData

expenses_bp = APIBlueprint("expenses", __name__, url_prefix="/api")


def _data_from(json_data: dict) -> ExpenseData:
    return ExpenseData(
        amount_minor=json_data["amount_minor"],
        currency=json_data["currency"],
        occurred_on=json_data["occurred_on"],
        category=json_data.get("category"),
        service_id=json_data.get("service_id"),
        note=json_data.get("note"),
        is_recurring=json_data.get("is_recurring", False),
    )


@expenses_bp.get("/expenses")
@expenses_bp.auth_required(bearer_auth)
@expenses_bp.input(ExpenseListQuery, location="query")
@expenses_bp.output(ExpenseOut(many=True))
@expenses_bp.doc(summary="List expenses in the active household.", tags=["Expenses"])
def list_expenses(query_data: dict) -> list:
    return expense_service.list_expenses(
        current_membership(),
        year=query_data.get("year"),
        month=query_data.get("month"),
        category=query_data.get("category"),
    )


@expenses_bp.post("/expenses")
@expenses_bp.auth_required(bearer_auth)
@expenses_bp.input(ExpenseIn)
@expenses_bp.output(ExpenseOut, status_code=201)
@expenses_bp.doc(summary="Record an expense.", tags=["Expenses"])
def create_expense(json_data: dict):
    try:
        return expense_service.create(current_membership(), _data_from(json_data))
    except InvalidExpense:
        abort(422, "Invalid expense (check the amount and currency).")


@expenses_bp.get("/expenses/overview")
@expenses_bp.auth_required(bearer_auth)
@expenses_bp.input(MonthlyOverviewQuery, location="query")
@expenses_bp.output(MonthlyOverviewOut)
@expenses_bp.doc(
    summary="Monthly overview: per-currency, per-category totals with month-over-month "
    "delta and fixed/variable split.",
    tags=["Expenses"],
)
def monthly_overview(query_data: dict):
    return expense_service.monthly_overview(
        current_membership(), year=query_data["year"], month=query_data["month"]
    )


@expenses_bp.get("/expenses/<expense_id>")
@expenses_bp.auth_required(bearer_auth)
@expenses_bp.output(ExpenseOut)
@expenses_bp.doc(summary="Fetch a single expense.", tags=["Expenses"])
def get_expense(expense_id: str):
    try:
        return expense_service.get(current_membership(), expense_id)
    except ExpenseNotFound:
        abort(404, "Expense not found.")


@expenses_bp.patch("/expenses/<expense_id>")
@expenses_bp.auth_required(bearer_auth)
@expenses_bp.input(ExpenseIn(partial=True))
@expenses_bp.output(ExpenseOut)
@expenses_bp.doc(summary="Update an expense.", tags=["Expenses"])
def update_expense(expense_id: str, json_data: dict):
    try:
        return expense_service.update(current_membership(), expense_id, json_data)
    except ExpenseNotFound:
        abort(404, "Expense not found.")
    except InvalidExpense:
        abort(422, "Invalid expense (check the amount and currency).")


@expenses_bp.delete("/expenses/<expense_id>")
@expenses_bp.auth_required(bearer_auth)
@expenses_bp.output(EmptySchema, status_code=204)
@expenses_bp.doc(summary="Soft-delete an expense.", tags=["Expenses"])
def delete_expense(expense_id: str) -> tuple[str, int]:
    try:
        expense_service.delete(current_membership(), expense_id)
    except ExpenseNotFound:
        abort(404, "Expense not found.")
    return "", 204
