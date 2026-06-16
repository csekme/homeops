"""RBAC engine (spec §3.2, §7.2; plan §4.2).

Phase 0 shipped the ``has_permission`` seam. Phase 1 turns it into the mandatory,
service-level gate every tenant operation passes through: each service method begins
with :func:`require_permission`, so authorization is enforced in one layer rather than
scattered across controllers.

The role lives in the signed access token (issued from the user's real membership at
login/switch — never from the request body), and permissions are resolved from the
:data:`app.domain.enums.ROLE_PERMISSIONS` catalogue (the same catalogue seeded into the
``roles`` table). Resolution is in-memory and keyed by role: no per-request query, and a
shared fixture pins the catalogue to the frontend ``@homeops/core`` permission set.

Note: because the role is read from a short-lived access token, a role change takes
effect on the next token refresh — acceptable given the token TTL.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.domain.enums import ROLE_PERMISSIONS
from app.domain.enums import Role as RoleEnum
from app.services.exceptions import PermissionDenied


@dataclass(frozen=True)
class MembershipContext:
    """The current actor's tenant context, derived from the access-token claims.

    Distinct from the ORM ``Membership`` model: this is the lightweight, request-scoped
    view (no DB row) that the RBAC gate and tenant-scoped services operate on. The
    ``household_id`` here is authoritative for RLS — it comes from the token, not the body.
    """

    user_id: str
    household_id: str
    role: RoleEnum


def resolve_permissions(role: RoleEnum) -> list[str]:
    """Return the fine-grained permission list granted to ``role``."""
    return ROLE_PERMISSIONS.get(role, [])


def has_permission(permissions: list[str], permission: str) -> bool:
    """Pure membership test against an already-resolved permission list (Phase 0 seam)."""
    return permission in permissions


def require_permission(membership: MembershipContext, permission: str) -> None:
    """Authorization gate: raise :class:`PermissionDenied` unless ``membership``'s role
    grants ``permission``. Returns ``None`` when allowed so call sites read as a guard."""
    if not has_permission(resolve_permissions(membership.role), permission):
        raise PermissionDenied(permission)
