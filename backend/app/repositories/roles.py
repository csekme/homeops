"""Role catalogue data access (feature plan §Backend).

The ``roles`` table is global (seeded in the initial migration, not RLS-scoped), so these
lookups work under any session mode. Roles are referenced by name — never by a hardcoded
UUID — so the catalogue can evolve without touching call sites.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Role


def get_by_name(session: Session, name: str) -> Role | None:
    return session.execute(select(Role).where(Role.name == name)).scalar_one_or_none()
