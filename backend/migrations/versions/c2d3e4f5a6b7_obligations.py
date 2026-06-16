"""obligations: one-off + recurring (RRULE) tasks (plan §4.4)

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-06-16 12:00:00.000000

A tenant-scoped ``obligations`` table (``household_id`` + RLS policy, like every content
table — plan §3.1). Each row carries a calendar ``due_date`` and an optional iCal RRULE;
completing/skipping a recurring obligation spawns the next occurrence (the service owns
that flow). Status is a *stored* lifecycle value (UPCOMING/DONE/SKIPPED) — the derived
DUE/OVERDUE display state is computed at read time from ``due_date`` + ``lead_time_days``.

Money columns follow the project rule: integer minor units (``BigInteger``) paired with a
``CHAR(3)`` ISO-4217 ``currency`` guarded by a regex CHECK — never a float.

The composite ``(household_id, due_date, status)`` index serves both the dashboard
(upcoming-window scans) and the Phase-1 scheduler (due-soon sweeps).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c2d3e4f5a6b7"
down_revision: str | None = "b1c2d3e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "obligations"
_STATUSES = ("UPCOMING", "DUE", "DONE", "OVERDUE", "SKIPPED")


def _predicate(column: str) -> str:
    """Null-safe bypass-or-match RLS predicate keyed on ``column`` (plan §3.6)."""
    return (
        "current_setting('app.bypass_tenant', true) = 'on' "
        f"OR {column} = NULLIF(current_setting('app.current_household', true), '')::uuid"
    )


def upgrade() -> None:
    status_list = ", ".join(f"'{s}'" for s in _STATUSES)
    op.create_table(
        _TABLE,
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("household_id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("rrule", sa.String(length=500), nullable=True),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("assignee_membership_id", sa.UUID(), nullable=True),
        sa.Column("estimated_amount_minor", sa.BigInteger(), nullable=True),
        sa.Column("actual_amount_minor", sa.BigInteger(), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=True),
        sa.Column("lead_time_days", sa.Integer(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            name=op.f("fk_obligations_household_id_households"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["assignee_membership_id"],
            ["memberships.id"],
            name=op.f("fk_obligations_assignee_membership_id_memberships"),
            ondelete="SET NULL",
        ),
        sa.CheckConstraint(f"status IN ({status_list})", name=op.f("ck_obligations_obligation_status_valid")),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name=op.f("ck_obligations_currency_iso4217")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_obligations")),
    )
    op.create_index(op.f("ix_obligations_household_id"), _TABLE, ["household_id"], unique=False)
    op.create_index(
        op.f("ix_obligations_assignee_membership_id"),
        _TABLE,
        ["assignee_membership_id"],
        unique=False,
    )
    # Dashboard upcoming-window + scheduler due-soon sweeps both fan out on this composite.
    op.create_index(
        "ix_obligations_household_due_status",
        _TABLE,
        ["household_id", "due_date", "status"],
        unique=False,
    )

    predicate = _predicate("household_id")
    op.execute(f"ALTER TABLE {_TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {_TABLE}_tenant_isolation ON {_TABLE} "
        f"USING ({predicate}) WITH CHECK ({predicate})"
    )


def downgrade() -> None:
    op.execute(f"DROP POLICY IF EXISTS {_TABLE}_tenant_isolation ON {_TABLE}")
    op.drop_index("ix_obligations_household_due_status", table_name=_TABLE)
    op.drop_index(op.f("ix_obligations_assignee_membership_id"), table_name=_TABLE)
    op.drop_index(op.f("ix_obligations_household_id"), table_name=_TABLE)
    op.drop_table(_TABLE)
