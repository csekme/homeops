"""Health endpoints (plan §3.1 acceptance, spec §11).

- ``/api/health`` — simple liveness reachable through the proxy (plan acceptance).
- ``/healthz``    — liveness (direct on the backend port).
- ``/readyz``     — readiness: verifies DB connectivity.
"""

from __future__ import annotations

from apiflask import APIBlueprint
from flask import jsonify
from sqlalchemy import text

from app.db.session import db

health_bp = APIBlueprint("health", __name__)


@health_bp.get("/api/health")
@health_bp.doc(summary="Liveness probe", operation_id="health", tags=["System"], security=[])
def health() -> dict[str, str]:
    return {"status": "ok"}


@health_bp.get("/healthz")
@health_bp.doc(hide=True)
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@health_bp.get("/readyz")
@health_bp.doc(hide=True)
def readyz() -> tuple[object, int]:
    checks: dict[str, str] = {}
    status_code = 200
    try:
        with db.new_session() as session:
            session.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception:  # readiness must not leak details
        checks["database"] = "error"
        status_code = 503
    status = "ok" if status_code == 200 else "degraded"
    return jsonify({"status": status, "checks": checks}), status_code
