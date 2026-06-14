"""Tenant session-wiring — the cornerstone of the dual-layer isolation (plan §3.6, §14).

Every unit of work runs inside a transaction that first sets the PostgreSQL GUCs the
RLS policies read:

- ``app.current_household`` — the active tenant, taken from the JWT claim, **never** from
  a client body. Tenant-scoped rows outside this household are invisible to the policy.
- ``app.bypass_tenant`` — the "no-tenant" mode (plan §3.6) for auth / household-creation
  flows that must read across households (e.g. "which households does this user belong
  to?"). Set only by trusted server code, never derived from request input.

We use ``set_config(key, value, is_local => true)`` so the setting is scoped to the
current transaction (the parameterised, injection-safe equivalent of ``SET LOCAL``).
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import db

GUC_CURRENT_HOUSEHOLD = "app.current_household"
GUC_BYPASS_TENANT = "app.bypass_tenant"

_SET_HOUSEHOLD = text("SELECT set_config(:k, :v, true)")
_SET_BYPASS = text("SELECT set_config(:k, 'on', true)")


def apply_tenant_context(
    session: Session,
    *,
    household_id: uuid.UUID | str | None,
    bypass_tenant: bool,
) -> None:
    """Set the per-transaction tenant GUCs on an already-open transaction."""
    if bypass_tenant:
        session.execute(_SET_BYPASS, {"k": GUC_BYPASS_TENANT})
    if household_id is not None:
        session.execute(_SET_HOUSEHOLD, {"k": GUC_CURRENT_HOUSEHOLD, "v": str(household_id)})


@contextmanager
def session_scope(
    *,
    household_id: uuid.UUID | str | None = None,
    bypass_tenant: bool = False,
) -> Iterator[Session]:
    """Open a session, set the tenant context, commit on success / rollback on error.

    Tenant-scoped operations pass ``household_id``; auth/no-tenant operations pass
    ``bypass_tenant=True``. Passing neither leaves tenant tables empty by policy.
    """
    session = db.new_session()
    try:
        # Opening a transaction explicitly guarantees the GUCs and the queries that
        # rely on them share one transaction (set_config local-scope requirement).
        session.begin()
        apply_tenant_context(session, household_id=household_id, bypass_tenant=bypass_tenant)
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
