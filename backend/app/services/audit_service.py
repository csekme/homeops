"""Central audit helper (plan §4.8).

Every sensitive operation routes through here so the audit trail is written in **one**
place. Crucially, the audit row is appended on the **caller's session** — i.e. inside the
same transaction as the operation it records — so the two commit or roll back atomically:
an action is never logged unless it actually happened, and vice versa.

``ip``/``ua`` are captured best-effort from the active Flask request; outside a request
context (e.g. the scheduler in 4.7) they are simply ``None``.
"""

from __future__ import annotations

import uuid

from flask import has_request_context, request
from sqlalchemy.orm import Session

from app.repositories import audit as audit_repo
from app.security.rbac import MembershipContext


def _request_meta() -> tuple[str | None, str | None]:
    if not has_request_context():
        return None, None
    return request.remote_addr, request.headers.get("User-Agent")


def record(
    session: Session,
    *,
    household_id: uuid.UUID | str,
    actor_user_id: uuid.UUID | str,
    action: str,
    target_type: str,
    target_id: uuid.UUID | str | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    """Append an audit row using explicit identifiers (for no-tenant flows like invite
    acceptance, where there is no :class:`MembershipContext` yet)."""
    ip, ua = _request_meta()
    audit_repo.append(
        session,
        household_id=household_id,
        actor_user_id=actor_user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata,
        ip=ip,
        ua=ua,
    )


def audit(
    session: Session,
    membership: MembershipContext,
    action: str,
    target_type: str,
    *,
    target_id: uuid.UUID | str | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    """Append an audit row for an action taken by ``membership`` in its household."""
    record(
        session,
        household_id=membership.household_id,
        actor_user_id=membership.user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata,
    )
