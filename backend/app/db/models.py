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
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    LargeBinary,
    String,
    UniqueConstraint,
    func,
    text,
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


class RefreshToken(UUIDPrimaryKeyMixin, Base):
    """Server-side refresh token record (plan §3.5c/§3.5d).

    Only the SHA-256 hash of the opaque token is stored. Rotation links rows via
    ``family_id``/``prev_id``; replaying a used/revoked token revokes the whole family.
    """

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # Active household carried by this session, so a token refresh re-mints the access token
    # into the *same* household the user switched to — never silently snapping back to their
    # first membership (household_service.switch / household_service.create set this). NULL
    # for users with no active household yet; user-scoped table, not subject to RLS.
    household_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("households.id", ondelete="SET NULL"), nullable=True
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


class PasswordResetToken(UUIDPrimaryKeyMixin, Base):
    """Single-use, expiring password-reset token (feature plan §#1). Hash-only storage.

    Mirrors ``ActivationToken``: only the SHA-256 hash of the opaque token is stored, the
    token is one-shot (``used_at``) and short-lived (``expires_at``). User-scoped (no
    ``household_id``) → not subject to RLS, accessed only in no-tenant mode.
    """

    __tablename__ = "password_reset_tokens"

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

    __table_args__ = (Index("ix_password_reset_tokens_user_id", "user_id"),)


class Invitation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Email-bound, single-use, expiring household invitation (feature plan §Backend).

    Tenant-scoped (``household_id`` discriminator) → RLS applies, so create/list/revoke run
    in the inviter's household context. **Acceptance is the exception**: the invitee is not
    yet a member, so ``invitation_service.accept`` runs in no-tenant mode and the
    email-binding check (accepting user's email == ``email``) is the compensating control
    that replaces RLS for that one flow. Modeled on ``ActivationToken`` (hash-only storage).
    """

    __tablename__ = "invitations"

    household_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Invitee-side rejection (feature plan §#4), distinct from ``revoked_at`` (inviter-side
    # withdrawal). A declined invite is no longer pending, freeing the (household, email) slot
    # for a fresh invite.
    declined_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invited_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    household: Mapped[Household] = relationship()
    role: Mapped[Role] = relationship()

    __table_args__ = (
        # One live (pending) invite per (household, email); accepted/revoked/declined rows
        # don't count so a re-invite afterwards is allowed. Mirrors the migration's partial
        # index.
        Index(
            "uq_invitations_pending_email",
            "household_id",
            "email",
            unique=True,
            postgresql_where=text(
                "accepted_at IS NULL AND revoked_at IS NULL AND declined_at IS NULL"
            ),
        ),
    )


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
    "Household",
    "Invitation",
    "Membership",
    "PasswordResetToken",
    "RecoveryCode",
    "RefreshToken",
    "Role",
    "RoleEnum",
    "User",
    "UserTotp",
]
