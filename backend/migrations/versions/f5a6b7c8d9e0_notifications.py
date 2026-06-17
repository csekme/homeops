"""notifications: outbox + delivery preferences (plan §4.7)

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-06-17 11:00:00.000000

Two tenant-scoped tables (``household_id`` + RLS, like every content table):

- ``notifications`` — the transactional **outbox**. A scheduler enqueues rows idempotently
  (``dedup_key`` UNIQUE + ``INSERT ... ON CONFLICT DO NOTHING``); a separate worker process
  claims due rows with ``FOR UPDATE SKIP LOCKED`` and sends them, retrying with exponential
  backoff until success (``SENT``) or exhaustion (``DEAD``). The ``(status, next_attempt_at)``
  index drives the worker claim.
- ``notification_preferences`` — per (user, household, type, channel) opt-in with optional
  per-type ``lead_times`` (days before due). UNIQUE on the full tuple for upsert.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "f5a6b7c8d9e0"
down_revision: str | None = "e4f5a6b7c8d9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TYPES = ("OBLIGATION_DUE", "PAYMENT_DUE", "OVERDUE", "INVITATION", "WEEKLY_DIGEST")
_CHANNELS = ("EMAIL",)
_STATUSES = ("PENDING", "SENT", "FAILED", "DEAD")


def _predicate(column: str) -> str:
    return (
        "current_setting('app.bypass_tenant', true) = 'on' "
        f"OR {column} = NULLIF(current_setting('app.current_household', true), '')::uuid"
    )


def _in_list(values: tuple[str, ...]) -> str:
    return ", ".join(f"'{v}'" for v in values)


def _enable_rls(table: str) -> None:
    predicate = _predicate("household_id")
    op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {table}_tenant_isolation ON {table} "
        f"USING ({predicate}) WITH CHECK ({predicate})"
    )


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("household_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=False),
        sa.Column("dedup_key", sa.String(length=200), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            name=op.f("fk_notifications_household_id_households"),
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(f"type IN ({_in_list(_TYPES)})", name=op.f("ck_notifications_type_valid")),
        sa.CheckConstraint(
            f"channel IN ({_in_list(_CHANNELS)})", name=op.f("ck_notifications_channel_valid")
        ),
        sa.CheckConstraint(
            f"status IN ({_in_list(_STATUSES)})", name=op.f("ck_notifications_status_valid")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notifications")),
        sa.UniqueConstraint("dedup_key", name=op.f("uq_notifications_dedup_key")),
    )
    op.create_index(op.f("ix_notifications_household_id"), "notifications", ["household_id"])
    # Worker claim: due rows by (status, next_attempt_at).
    op.create_index(
        "ix_notifications_status_next_attempt",
        "notifications",
        ["status", "next_attempt_at"],
    )
    _enable_rls("notifications")

    op.create_table(
        "notification_preferences",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("household_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("channel", sa.String(length=16), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("lead_times", postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            name=op.f("fk_notification_preferences_household_id_households"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_notification_preferences_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.CheckConstraint(
            f"type IN ({_in_list(_TYPES)})", name=op.f("ck_notification_preferences_type_valid")
        ),
        sa.CheckConstraint(
            f"channel IN ({_in_list(_CHANNELS)})",
            name=op.f("ck_notification_preferences_channel_valid"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_notification_preferences")),
        sa.UniqueConstraint(
            "user_id",
            "household_id",
            "type",
            "channel",
            name=op.f("uq_notification_preferences_user_id"),
        ),
    )
    op.create_index(
        op.f("ix_notification_preferences_household_id"),
        "notification_preferences",
        ["household_id"],
    )
    _enable_rls("notification_preferences")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS notification_preferences_tenant_isolation ON notification_preferences")
    op.drop_index(
        op.f("ix_notification_preferences_household_id"), table_name="notification_preferences"
    )
    op.drop_table("notification_preferences")

    op.execute("DROP POLICY IF EXISTS notifications_tenant_isolation ON notifications")
    op.drop_index("ix_notifications_status_next_attempt", table_name="notifications")
    op.drop_index(op.f("ix_notifications_household_id"), table_name="notifications")
    op.drop_table("notifications")
