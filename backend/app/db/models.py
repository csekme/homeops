"""ORM models for the Phase 0 schema (plan §3.3): users, households, roles,
memberships, plus the auth-support tables refresh_tokens and activation_tokens.

Money rule (plan §3.3): every amount is a ``BigInteger *_amount_minor`` paired with a
``CHAR(3)`` ISO-4217 ``currency`` — never a float. (Amount columns arrive with the
content tables in Phase 1; the currency CHECK pattern is established here on households.)
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.domain.enums import Role as RoleEnum
from app.domain.enums import UserStatus

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


__all__ = [
    "ActivationToken",
    "Household",
    "Membership",
    "RefreshToken",
    "Role",
    "RoleEnum",
    "User",
]
