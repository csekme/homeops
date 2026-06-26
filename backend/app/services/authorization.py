"""Membership-based authorization (feature plan §Backend).

The single source of truth for "may this user do X in this household?" is the membership
row read **in-transaction** — never the JWT ``role`` claim, which goes stale the moment an
OWNER changes someone's role (the old access token keeps its old role until it expires).
Every privileged household operation calls ``require_permission`` first.

Permissions come from ``Role.permissions`` (seeded per ``ROLE_PERMISSIONS``). This is the
role-based-only model for this iteration; per-member overrides are a later phase.
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.db.models import Membership
from app.repositories import memberships as membership_repo
from app.services.exceptions import NotAMember, PermissionDenied


def load_membership(
    session: Session, *, user_id: uuid.UUID | str, household_id: uuid.UUID | str
) -> Membership:
    """Return the caller's membership in the household or raise ``NotAMember`` (→ 404)."""
    membership = membership_repo.get(session, user_id=user_id, household_id=household_id)
    if membership is None:
        raise NotAMember("not a member of this household")
    return membership


def require_permission(
    session: Session,
    *,
    user_id: uuid.UUID | str,
    household_id: uuid.UUID | str,
    permission: str,
) -> Membership:
    """Authorize an operation, returning the caller's membership for downstream use.

    Raises ``NotAMember`` if the caller has no membership, ``PermissionDenied`` if their
    role's permission set doesn't include ``permission``.
    """
    membership = load_membership(session, user_id=user_id, household_id=household_id)
    if permission not in (membership.role.permissions or []):
        raise PermissionDenied(f"missing permission: {permission}")
    return membership
