"""ORM models for the Phase 0 schema (plan §3.3): users, households, roles,
memberships, plus the auth-support tables refresh_tokens and activation_tokens.

Money rule (plan §3.3): every amount is a ``BigInteger *_amount_minor`` paired with a
``CHAR(3)`` ISO-4217 ``currency`` — never a float. (Amount columns arrive with the
content tables in Phase 1; the currency CHECK pattern is established here on households.)
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.domain.enums import ObligationStatus, UserStatus
from app.domain.enums import Role as RoleEnum

CURRENCY_CHECK = "currency_iso4217"


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Catalogue of RBAC roles with their fine-grained permission set (spec §3.2)."""

    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    permissions: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Global, email-bound account. A user can belong to several households (spec §2)."""

    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=UserStatus.PENDING.value
    )
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    memberships: Mapped[list[Membership]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
    # 1:1 TOTP enrolment (NULL until the user enables 2FA). Convenience accessor —
    # the service still owns all the business logic (mirrors the `memberships` pattern).
    totp: Mapped[UserTotp | None] = relationship(
        back_populates="user", uselist=False, cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING','ACTIVE','DISABLED')",
            name="user_status_valid",
        ),
    )


class Household(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """The tenant root. RLS policies key on this table's own ``id`` (plan §3.6)."""

    __tablename__ = "households"

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    default_currency: Mapped[str] = mapped_column(String(3), nullable=False, default="HUF")
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    memberships: Mapped[list[Membership]] = relationship(
        back_populates="household", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "default_currency ~ '^[A-Z]{3}$'",
            name=CURRENCY_CHECK,
        ),
    )


class Membership(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """User ↔ Household link carrying the role (spec §2). Tenant-scoped → RLS applies."""

    __tablename__ = "memberships"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Tenant discriminator — declared explicitly (not via TenantMixin) so the FK target
    # is unambiguous and the (user_id, household_id) uniqueness reads clearly.
    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False
    )

    user: Mapped[User] = relationship(back_populates="memberships")
    household: Mapped[Household] = relationship(back_populates="memberships")
    role: Mapped[Role] = relationship()

    __table_args__ = (UniqueConstraint("user_id", "household_id", name="user_household"),)


class Invitation(UUIDPrimaryKeyMixin, TenantMixin, Base):
    """Pending invitation to join a household with a chosen role (plan §4.3).

    Tenant-scoped (``household_id`` via ``TenantMixin``) → RLS applies; listing/managing
    invitations happens in the inviter's household context. **Acceptance**, however, runs
    in no-tenant mode (the invitee isn't a member yet): the row is found by ``token_hash``,
    exactly like activation tokens — hash-only storage, single-use, expiring.
    """

    __tablename__ = "invitations"

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Who sent it. SET NULL on member removal so the invite (and later audit) survives.
    created_by_membership_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("memberships.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    role: Mapped[Role] = relationship()


class Obligation(UUIDPrimaryKeyMixin, TimestampMixin, TenantMixin, Base):
    """A one-off or recurring (RRULE) household task with an optional assignee (plan §4.4).

    Tenant-scoped (``household_id`` via ``TenantMixin``) → RLS applies. ``status`` is the
    *stored* lifecycle (UPCOMING/DONE/SKIPPED); the derived DUE/OVERDUE display state is
    computed at read time from ``due_date`` + ``lead_time_days`` (``derive_status``). For a
    recurring obligation, completing/skipping spawns the next occurrence row (the service
    owns that flow). Money follows the project rule: integer minor units + ISO-4217.
    """

    __tablename__ = "obligations"

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    rrule: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        String(16), nullable=False, default=ObligationStatus.UPCOMING.value
    )
    # The responsible member. SET NULL on member removal so the obligation survives.
    assignee_membership_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("memberships.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    estimated_amount_minor: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    actual_amount_minor: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    currency: Mapped[str | None] = mapped_column(String(3), nullable=True)
    lead_time_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    assignee: Mapped[Membership | None] = relationship()

    __table_args__ = (
        CheckConstraint(
            "status IN ('UPCOMING','DUE','DONE','OVERDUE','SKIPPED')",
            name="obligation_status_valid",
        ),
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name=CURRENCY_CHECK),
        # Dashboard upcoming-window + scheduler due-soon sweeps fan out on this composite.
        Index("ix_obligations_household_due_status", "household_id", "due_date", "status"),
    )


class Expense(UUIDPrimaryKeyMixin, TimestampMixin, TenantMixin, Base):
    """A single household money entry (plan §4.5).

    Tenant-scoped (``household_id`` via ``TenantMixin``) → RLS applies. Money follows the
    project rule: ``amount_minor`` integer minor units + a per-line ISO-4217 ``currency``
    — the monthly overview aggregates per (currency, category) and never adds across
    currencies (no FX, decision §10.1). ``service_id`` is a Phase-2 seam (nullable UUID,
    no FK yet). ``is_recurring`` splits the overview into fixed vs variable spend.
    """

    __tablename__ = "expenses"

    amount_minor: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    occurred_on: Mapped[date] = mapped_column(Date, nullable=False)
    category: Mapped[str | None] = mapped_column(String(80), nullable=True)
    # Phase-2 services FK seam — plain nullable UUID, no constraint until the table exists.
    service_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("currency ~ '^[A-Z]{3}$'", name=CURRENCY_CHECK),
        # Overview + dashboard month-window scans fan out on this composite.
        Index("ix_expenses_household_occurred", "household_id", "occurred_on"),
    )


class AuditLog(UUIDPrimaryKeyMixin, TenantMixin, Base):
    """Append-only audit trail for sensitive operations (plan §4.8).

    Tenant-scoped (``household_id`` via ``TenantMixin``) → RLS applies. There is **no**
    ``TimestampMixin``: an audit row has only a ``created_at``, never an ``updated_at`` —
    the row is immutable (enforced in the DB by a REVOKE + a block trigger). The Python
    attribute is ``event_metadata`` because ``metadata`` is reserved on the declarative
    base; it maps to the ``metadata`` JSONB column.
    """

    __tablename__ = "audit_log"

    actor_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str] = mapped_column(String(100), nullable=False)
    target_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    event_metadata: Mapped[dict] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    ua: Mapped[str | None] = mapped_column(String(400), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class RefreshToken(UUIDPrimaryKeyMixin, Base):
    """Server-side refresh token record (plan §3.5c/§3.5d).

    Only the SHA-256 hash of the opaque token is stored. Rotation links rows via
    ``family_id``/``prev_id``; replaying a used/revoked token revokes the whole family.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    family_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    prev_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(400), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_refresh_tokens_family_id", "family_id"),
        Index("ix_refresh_tokens_user_id", "user_id"),
    )


class ActivationToken(UUIDPrimaryKeyMixin, Base):
    """Single-use, expiring account activation token (plan §3.5b). Hash-only storage."""

    __tablename__ = "activation_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (Index("ix_activation_tokens_user_id", "user_id"),)


class UserTotp(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Per-user TOTP enrolment (2FA, feature plan §Backend.2).

    User-scoped (no ``household_id``) → not subject to RLS, like ``users``/``refresh_tokens``;
    accessed only in no-tenant mode. The base32 TOTP secret is **envelope-encrypted** with
    the shared ``SecretCipher`` and stored as the three ``SealedSecret`` columns — the
    plaintext secret never lands in the DB. The row exists from the moment setup starts;
    ``confirmed_at`` flips it to *enabled* only after the user proves a valid code.
    """

    __tablename__ = "user_totp"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # Envelope-encrypted base32 secret — maps 1:1 to SealedSecret(ciphertext, wrapped_dek, kek_id).
    secret_ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    secret_wrapped_dek: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    secret_kek_id: Mapped[str] = mapped_column(String(64), nullable=False)
    # NULL until the enrolment is confirmed with a valid code → drives `enabled`.
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Replay protection: the last accepted TOTP time-step. A code for a step <= this is rejected.
    last_used_step: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    user: Mapped[User] = relationship(back_populates="totp")

    @property
    def enabled(self) -> bool:
        return self.confirmed_at is not None


class RecoveryCode(UUIDPrimaryKeyMixin, Base):
    """Single-use 2FA backup code (feature plan §Backend.2). Hash-only storage.

    High-entropy codes (mirrors the refresh-token model), so SHA-256 — not a password
    hash — is sufficient. ``used_at`` makes each code one-shot.
    """

    __tablename__ = "recovery_codes"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    code_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (Index("ix_recovery_codes_user_id", "user_id"),)


__all__ = [
    "ActivationToken",
    "AuditLog",
    "Expense",
    "Household",
    "Invitation",
    "Membership",
    "Obligation",
    "RecoveryCode",
    "RefreshToken",
    "Role",
    "RoleEnum",
    "User",
    "UserTotp",
]
