"""invitations: household invite flow (plan §4.3)

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-06-16 10:00:00.000000

A tenant-scoped ``invitations`` table (``household_id`` + RLS policy, like every content
table) holding pending, single-use, expiring invites. Hash-only token storage mirrors
``activation_tokens``.

This migration also hardens the RLS predicate on the Phase 0 tenant tables. A custom GUC
set with ``set_config(..., is_local => true)`` does not revert to *undefined* at
transaction end — it reverts to the empty string ``''``. A later no-tenant (bypass)
transaction reusing the same pooled connection would then evaluate ``''::uuid`` and raise
``invalid input syntax for type uuid``. Wrapping the read in ``NULLIF(..., '')`` turns the
empty reset value back into ``NULL`` so the comparison is null-safe and the bypass branch
governs. All tenant policies (households, memberships, invitations) use this hardened form.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "invitations"


def _predicate(column: str) -> str:
    """Null-safe bypass-or-match RLS predicate keyed on ``column`` (plan §3.6)."""
    return (
        "current_setting('app.bypass_tenant', true) = 'on' "
        f"OR {column} = NULLIF(current_setting('app.current_household', true), '')::uuid"
    )


# Phase 0 tenant tables and the discriminator column their policy keys on. Repaired here
# to the null-safe predicate (see the module docstring).
_PHASE0_TABLES: list[tuple[str, str]] = [
    ("households", "id"),
    ("memberships", "household_id"),
]
# The original Phase 0 predicate, restored verbatim on downgrade.
_OLD_PREDICATE = (
    "current_setting('app.bypass_tenant', true) = 'on' "
    "OR {column} = current_setting('app.current_household', true)::uuid"
)


def upgrade() -> None:
    op.create_table(
        _TABLE,
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("household_id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_membership_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["household_id"],
            ["households.id"],
            name=op.f("fk_invitations_household_id_households"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["role_id"],
            ["roles.id"],
            name=op.f("fk_invitations_role_id_roles"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["created_by_membership_id"],
            ["memberships.id"],
            name=op.f("fk_invitations_created_by_membership_id_memberships"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invitations")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_invitations_token_hash")),
    )
    op.create_index(op.f("ix_invitations_household_id"), _TABLE, ["household_id"], unique=False)

    # RLS: null-safe tenant isolation (plan §3.6).
    predicate = _predicate("household_id")
    op.execute(f"ALTER TABLE {_TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"CREATE POLICY {_TABLE}_tenant_isolation ON {_TABLE} "
        f"USING ({predicate}) WITH CHECK ({predicate})"
    )

    # Harden the Phase 0 policies to the null-safe predicate.
    for table, column in _PHASE0_TABLES:
        predicate = _predicate(column)
        op.execute(f"DROP POLICY {table}_tenant_isolation ON {table}")
        op.execute(
            f"CREATE POLICY {table}_tenant_isolation ON {table} "
            f"USING ({predicate}) WITH CHECK ({predicate})"
        )


def downgrade() -> None:
    # Restore the original (non-null-safe) Phase 0 policies.
    for table, column in _PHASE0_TABLES:
        predicate = _OLD_PREDICATE.format(column=column)
        op.execute(f"DROP POLICY {table}_tenant_isolation ON {table}")
        op.execute(
            f"CREATE POLICY {table}_tenant_isolation ON {table} "
            f"USING ({predicate}) WITH CHECK ({predicate})"
        )

    op.execute(f"DROP POLICY IF EXISTS {_TABLE}_tenant_isolation ON {_TABLE}")
    op.drop_index(op.f("ix_invitations_household_id"), table_name=_TABLE)
    op.drop_table(_TABLE)
