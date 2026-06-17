"""Audit-log data access (plan §4.8). Append-only — the only operation is insert."""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import AuditLog


def append(
    session: Session,
    *,
    household_id: uuid.UUID | str,
    actor_user_id: uuid.UUID | str,
    action: str,
    target_type: str,
    target_id: uuid.UUID | str | None = None,
    metadata: dict[str, object] | None = None,
    ip: str | None = None,
    ua: str | None = None,
) -> AuditLog:
    entry = AuditLog(
        household_id=uuid.UUID(str(household_id)),
        actor_user_id=uuid.UUID(str(actor_user_id)),
        action=action,
        target_type=target_type,
        target_id=uuid.UUID(str(target_id)) if target_id else None,
        event_metadata=metadata or {},
        ip=ip,
        ua=ua,
    )
    session.add(entry)
    session.flush()
    return entry
