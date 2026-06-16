"""expenses: per-line money entries + monthly overview source (plan §4.5)

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-06-16 13:00:00.000000

A tenant-scoped ``expenses`` table (``household_id`` + RLS policy, like every content
table). Each row is an amount in integer minor units paired with a per-line ISO-4217
``currency`` — the monthly overview aggregates ``GROUP BY currency, category`` and never
adds across currencies (no FX in Phase 1, decision §10.1).

``service_id`` is a forward seam for the Phase-2 ``services`` table: a plain nullable UUID
column **without** a FK constraint for now, so there is no dangling reference until Phase 2
introduces the target table and wires the FK (plan §4.5.1, open decision H.2).

The ``(household_id, occurred_on)`` composite index serves the month-window scans the
overview and dashboard run.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d3e4f5a6b7c8"
down_revision: str | None = "c2d3e4f5a6b7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "expenses"


def _predicate(column: str) -> str:
    """Null-safe bypass-or-match RLS predicate keyed on ``column`` (plan §3.6)."""
    return (
        "current_setting('app.bypass_tenant', true) = 'on' "
        f"OR {column} = NULLIF(current_setting('app.current_household', true), '')::uuid"
    )


def upgrade() -> None:
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
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        # Phase-2 services FK seam: nullable UUID, no constraint yet (open decision H.2).
        sa.Column("service_id", sa.UUID(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_recurring", sa.Boolean(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            name=op.f("fk_expenses_household_id_households"),
            ondelete="CASCADE",
        ),
        sa.CheckConstraint("currency ~ '^[A-Z]{3}$'", name=op.f("ck_expenses_currency_iso4217")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_expenses")),
    )
    op.create_index(op.f("ix_expenses_household_id"), _TABLE, ["household_id"], unique=False)
    # Overview + dashboard month-window scans fan out on this composite.
    op.create_index(
        "ix_expenses_household_occurred",
        _TABLE,
        ["household_id", "occurred_on"],
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
    op.drop_index("ix_expenses_household_occurred", table_name=_TABLE)
    op.drop_index(op.f("ix_expenses_household_id"), table_name=_TABLE)
    op.drop_table(_TABLE)
