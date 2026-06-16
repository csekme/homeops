"""Obligation endpoints (plan §4.4).

Thin controllers: validate input, resolve the tenant context from the token via
``current_membership`` (never the body), delegate to ``obligation_service``, and translate
domain errors to HTTP. The RBAC gate lives in the service; ``PermissionDenied`` maps to
403 centrally (``errors.py``)."""

from __future__ import annotations

from apiflask import APIBlueprint, abort
from apiflask.schemas import EmptySchema

from app.api.schemas import ObligationIn, ObligationListQuery, ObligationOut
from app.api.security import bearer_auth, current_membership
from app.services import obligation_service
from app.services.exceptions import InvalidObligation, ObligationNotFound
from app.services.obligation_service import ObligationData, ObligationView

obligations_bp = APIBlueprint("obligations", __name__, url_prefix="/api")


def _data_from(json_data: dict) -> ObligationData:
    return ObligationData(
        title=json_data["title"],
        description=json_data.get("description"),
        category=json_data.get("category"),
        due_date=json_data["due_date"],
        rrule=json_data.get("rrule"),
        assignee_membership_id=json_data.get("assignee_membership_id"),
        estimated_amount_minor=json_data.get("estimated_amount_minor"),
        actual_amount_minor=json_data.get("actual_amount_minor"),
        currency=json_data.get("currency"),
        lead_time_days=json_data.get("lead_time_days", 0),
    )


def _dict(view: ObligationView) -> dict:
    return {
        "id": view.id,
        "title": view.title,
        "description": view.description,
        "category": view.category,
        "due_date": view.due_date,
        "rrule": view.rrule,
        "status": view.status,
        "assignee_membership_id": view.assignee_membership_id,
        "estimated_amount_minor": view.estimated_amount_minor,
        "actual_amount_minor": view.actual_amount_minor,
        "currency": view.currency,
        "lead_time_days": view.lead_time_days,
        "completed_at": view.completed_at,
    }


@obligations_bp.get("/obligations")
@obligations_bp.auth_required(bearer_auth)
@obligations_bp.input(ObligationListQuery, location="query")
@obligations_bp.output(ObligationOut(many=True))
@obligations_bp.doc(summary="List obligations in the active household.", tags=["Obligations"])
def list_obligations(query_data: dict) -> list[dict]:
    views = obligation_service.list_obligations(
        current_membership(),
        status=query_data.get("status"),
        assignee_membership_id=query_data.get("assignee"),
        due_from=query_data.get("due_from"),
        due_to=query_data.get("due_to"),
    )
    return [_dict(v) for v in views]


@obligations_bp.post("/obligations")
@obligations_bp.auth_required(bearer_auth)
@obligations_bp.input(ObligationIn)
@obligations_bp.output(ObligationOut, status_code=201)
@obligations_bp.doc(summary="Create a one-off or recurring obligation.", tags=["Obligations"])
def create_obligation(json_data: dict) -> dict:
    try:
        view = obligation_service.create(current_membership(), _data_from(json_data))
    except InvalidObligation:
        abort(422, "Invalid obligation (check the recurrence rule).")
    return _dict(view)


@obligations_bp.get("/obligations/<obligation_id>")
@obligations_bp.auth_required(bearer_auth)
@obligations_bp.output(ObligationOut)
@obligations_bp.doc(summary="Fetch a single obligation.", tags=["Obligations"])
def get_obligation(obligation_id: str) -> dict:
    try:
        view = obligation_service.get(current_membership(), obligation_id)
    except ObligationNotFound:
        abort(404, "Obligation not found.")
    return _dict(view)


@obligations_bp.patch("/obligations/<obligation_id>")
@obligations_bp.auth_required(bearer_auth)
@obligations_bp.input(ObligationIn(partial=True))
@obligations_bp.output(ObligationOut)
@obligations_bp.doc(summary="Update an obligation.", tags=["Obligations"])
def update_obligation(obligation_id: str, json_data: dict) -> dict:
    try:
        view = obligation_service.update(current_membership(), obligation_id, json_data)
    except ObligationNotFound:
        abort(404, "Obligation not found.")
    except InvalidObligation:
        abort(422, "Invalid obligation (check the recurrence rule).")
    return _dict(view)


@obligations_bp.delete("/obligations/<obligation_id>")
@obligations_bp.auth_required(bearer_auth)
@obligations_bp.output(EmptySchema, status_code=204)
@obligations_bp.doc(summary="Soft-delete an obligation.", tags=["Obligations"])
def delete_obligation(obligation_id: str) -> tuple[str, int]:
    try:
        obligation_service.delete(current_membership(), obligation_id)
    except ObligationNotFound:
        abort(404, "Obligation not found.")
    return "", 204


@obligations_bp.post("/obligations/<obligation_id>/complete")
@obligations_bp.auth_required(bearer_auth)
@obligations_bp.output(ObligationOut)
@obligations_bp.doc(
    summary="Mark complete; a recurring obligation spawns its next occurrence.",
    tags=["Obligations"],
)
def complete_obligation(obligation_id: str) -> dict:
    try:
        view = obligation_service.complete(current_membership(), obligation_id)
    except ObligationNotFound:
        abort(404, "Obligation not found.")
    return _dict(view)


@obligations_bp.post("/obligations/<obligation_id>/skip")
@obligations_bp.auth_required(bearer_auth)
@obligations_bp.output(ObligationOut)
@obligations_bp.doc(
    summary="Skip; a recurring obligation spawns its next occurrence.", tags=["Obligations"]
)
def skip_obligation(obligation_id: str) -> dict:
    try:
        view = obligation_service.skip(current_membership(), obligation_id)
    except ObligationNotFound:
        abort(404, "Obligation not found.")
    return _dict(view)
