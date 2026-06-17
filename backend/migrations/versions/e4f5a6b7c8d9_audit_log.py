"""audit_log: append-only audit trail for sensitive operations (plan §4.8)

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-06-17 09:00:00.000000

A tenant-scoped ``audit_log`` table (``household_id`` + RLS policy, like every content
table). It is **append-only**: rows are written once and never changed. Two independent
guards enforce that (defense-in-depth):

1. ``REVOKE UPDATE, DELETE ... FROM homeops_app`` — the application role simply lacks the
   privilege (the initial migration's ``ALTER DEFAULT PRIVILEGES`` would otherwise have
   granted it on this new table).
2. A ``BEFORE UPDATE OR DELETE`` trigger that raises — catches anything the grant model
   misses (e.g. a future role) and documents the intent at the schema level.

Unlike the other content tables this one has **no** ``updated_at`` — an audit row has no
lifecycle, only a birth.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "e4f5a6b7c8d9"
down_revision: str | None = "d3e4f5a6b7c8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "audit_log"
_APP_ROLE = "homeops_app"


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
        sa.Column("actor_user_id", sa.UUID(), nullable=False),
        sa.Column("action", sa.String(length=100), nullable=False),
        sa.Column("target_type", sa.String(length=100), nullable=False),
        sa.Column("target_id", sa.UUID(), nullable=True),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=True),
        sa.Column("ua", sa.String(length=400), nullable=True),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            name=op.f("fk_audit_log_household_id_households"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_log")),
    )
    op.create_index(op.f("ix_audit_log_household_id"), _TABLE, ["household_id"], unique=False)

    predicate = _predicate("household_id")
    op.execute(f"ALTER TABLE {_TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {_TABLE}_tenant_isolation ON {_TABLE} "
        f"USING ({predicate}) WITH CHECK ({predicate})"
    )

    # Guard 1: strip the privilege the default-privileges grant handed this new table.
    op.execute(f"REVOKE UPDATE, DELETE ON {_TABLE} FROM {_APP_ROLE}")

    # Guard 2: a trigger that refuses any update/delete, whatever the role.
    op.execute(
        """
        CREATE OR REPLACE FUNCTION audit_log_block_mutation() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'audit_log is append-only (% blocked)', TG_OP;
        END;
        $$ LANGUAGE plpgsql;
        """
    )
    op.execute(
        f"CREATE TRIGGER {_TABLE}_immutable "
        f"BEFORE UPDATE OR DELETE ON {_TABLE} "
        "FOR EACH ROW EXECUTE FUNCTION audit_log_block_mutation()"
    )


def downgrade() -> None:
    op.execute(f"DROP TRIGGER IF EXISTS {_TABLE}_immutable ON {_TABLE}")
    op.execute("DROP FUNCTION IF EXISTS audit_log_block_mutation()")
    op.execute(f"DROP POLICY IF EXISTS {_TABLE}_tenant_isolation ON {_TABLE}")
    op.drop_index(op.f("ix_audit_log_household_id"), table_name=_TABLE)
    op.drop_table(_TABLE)
