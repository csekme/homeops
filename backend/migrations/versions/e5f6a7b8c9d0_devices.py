"""device registration: devices table + refresh_tokens.device_id

Adds the user-visible device/session table (feature plan §Device registration + remember me)
and links refresh-token families to a device. User-scoped (no ``household_id``) → not subject
to RLS, exactly like ``refresh_tokens`` / ``password_reset_tokens``. Two hashed secrets:
``device_id_hash`` (stable identity for the session list) and ``trust_token_hash`` (rotating
2FA-bypass authority). ``refresh_tokens.device_id`` uses ``SET NULL`` so deleting a device
keeps token history; revocation is explicit.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-28 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: str | None = "d4e5f6a7b8c9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("device_id_hash", sa.String(length=64), nullable=False),
        sa.Column("trust_token_hash", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("platform", sa.String(length=16), nullable=False),
        sa.Column("user_agent", sa.String(length=400), nullable=True),
        sa.Column("last_ip", sa.String(length=45), nullable=True),
        sa.Column("trusted_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("remember", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("refresh_ttl_days", sa.Integer(), nullable=False),
        sa.Column("family_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.CheckConstraint(
            "platform IN ('web','ios','android')", name=op.f("ck_devices_device_platform_valid")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_devices_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_devices")),
        sa.UniqueConstraint("device_id_hash", name=op.f("uq_devices_device_id_hash")),
        sa.UniqueConstraint("trust_token_hash", name=op.f("uq_devices_trust_token_hash")),
    )
    op.create_index("ix_devices_user_id", "devices", ["user_id"], unique=False)

    op.add_column("refresh_tokens", sa.Column("device_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        op.f("fk_refresh_tokens_device_id_devices"),
        "refresh_tokens",
        "devices",
        ["device_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_refresh_tokens_device_id", "refresh_tokens", ["device_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_device_id", table_name="refresh_tokens")
    op.drop_constraint(
        op.f("fk_refresh_tokens_device_id_devices"), "refresh_tokens", type_="foreignkey"
    )
    op.drop_column("refresh_tokens", "device_id")
    op.drop_index("ix_devices_user_id", table_name="devices")
    op.drop_table("devices")
