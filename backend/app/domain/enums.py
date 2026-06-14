"""Domain enumerations shared across services and persistence.

Kept in sync with the frontend `@homeops/core` union types (spec §5.8). These are
plain string enums so they serialize cleanly and map to ``VARCHAR + CHECK`` columns.
"""

from __future__ import annotations

from enum import StrEnum


class Role(StrEnum):
    """Base RBAC roles (spec §3.2). The permission *engine* lands in Phase 1."""

    OWNER = "OWNER"
    ADMIN = "ADMIN"
    MEMBER = "MEMBER"
    VIEWER = "VIEWER"
    CHILD = "CHILD"


class UserStatus(StrEnum):
    """User lifecycle (plan §3.5a). Only ACTIVE users may log in."""

    PENDING = "PENDING"
    ACTIVE = "ACTIVE"
    DISABLED = "DISABLED"


# Default permission catalogue per role. The fine-grained enforcement (require_permission
# in the service layer) is Phase 1 (plan §4.2); seeded here so the role catalogue exists.
ROLE_PERMISSIONS: dict[Role, list[str]] = {
    Role.OWNER: [
        "expense.read",
        "expense.write",
        "obligation.read",
        "obligation.write",
        "document.read",
        "document.delete",
        "connector.manage",
        "member.invite",
        "member.manage",
        "household.delete",
        "billing.manage",
    ],
    Role.ADMIN: [
        "expense.read",
        "expense.write",
        "obligation.read",
        "obligation.write",
        "document.read",
        "document.delete",
        "connector.manage",
        "member.invite",
        "member.manage",
    ],
    Role.MEMBER: [
        "expense.read",
        "expense.write",
        "obligation.read",
        "obligation.write",
        "document.read",
    ],
    Role.VIEWER: [
        "obligation.read",
        "document.read",
    ],
    Role.CHILD: [
        "obligation.read",
    ],
}
