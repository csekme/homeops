"""Role catalogue lookups (plan §4.2/§4.3). The ``roles`` table is seeded by the initial
migration from the ``ROLE_PERMISSIONS`` catalogue and is effectively read-only at runtime."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Role
from app.domain.enums import Role as RoleEnum


def get_by_name(session: Session, name: RoleEnum | str) -> Role | None:
    value = name.value if isinstance(name, RoleEnum) else name
    return session.execute(select(Role).where(Role.name == value)).scalar_one_or_none()
