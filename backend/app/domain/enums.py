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


class ObligationStatus(StrEnum):
    """Derived display status of an obligation (spec §3.4, mirrors core/status.ts).

    UPCOMING/DUE/OVERDUE are *derived* from ``due_date`` + today; DONE/SKIPPED
    are terminal stored states. See :func:`app.domain.recurrence.derive_status`.
    """

    UPCOMING = "UPCOMING"
    DUE = "DUE"
    DONE = "DONE"
    OVERDUE = "OVERDUE"
    SKIPPED = "SKIPPED"


class BillingCycle(StrEnum):
    """Recurring service billing cadence (spec §3.5; consumed from Phase 1.x on)."""

    MONTHLY = "MONTHLY"
    QUARTERLY = "QUARTERLY"
    YEARLY = "YEARLY"


class NotificationType(StrEnum):
    """Outbox notification kinds (spec §3.6 / plan §4.7)."""

    OBLIGATION_DUE = "OBLIGATION_DUE"
    PAYMENT_DUE = "PAYMENT_DUE"
    OVERDUE = "OVERDUE"
    INVITATION = "INVITATION"
    WEEKLY_DIGEST = "WEEKLY_DIGEST"


class NotificationChannel(StrEnum):
    """Delivery channel. PUSH is additive in Phase 3 (plan §4.7)."""

    EMAIL = "EMAIL"


class NotificationStatus(StrEnum):
    """Outbox row lifecycle (plan §4.7). DEAD = retries exhausted."""

    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
    DEAD = "DEAD"


class ConnectorProvider(StrEnum):
    """External connector providers. Phase 2 extends this; the enum exists now."""

    GDRIVE = "GDRIVE"


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
