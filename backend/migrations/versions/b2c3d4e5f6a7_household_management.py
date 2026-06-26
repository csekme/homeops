"""household management: invitations table + refresh_tokens.household_id

Adds the email-bound invitation table (with its RLS policy) and the
``refresh_tokens.household_id`` column that lets a token refresh re-mint the access
token into the household the user switched to (feature plan §Backend).

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-26 00:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: str | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tenant-isolation predicate. The bypass branch is *intentionally* the invitation
# acceptance path: the invitee is not yet a member, so invitation_service.accept runs with
# app.bypass_tenant='on' and the email-binding check (accepting user's email ==
# invitations.email) is the compensating control. Do NOT remove the bypass branch — it would
# make invitations un-acceptable.
#
# NULLIF(..., '') guard: PostgreSQL does not guarantee OR short-circuit in an RLS qual, so
# the cast is evaluated even when bypass='on'. Once a custom GUC has been SET LOCAL on a
# pooled connection its reset value becomes '' (empty string), and ''::uuid throws. NULLIF
# maps '' (and the unset NULL) to NULL, which casts cleanly. This also repairs the same
# latent issue in the original households/memberships policies (recreated below).
def _predicate(column: str) -> str:
    return (
        "current_setting('app.bypass_tenant', true) = 'on' "
        f"OR {column} = NULLIF(current_setting('app.current_household', true), '')::uuid"
    )


# Original (unguarded) predicate from the initial migration — restored on downgrade.
def _legacy_predicate(column: str) -> str:
    return (
        "current_setting('app.bypass_tenant', true) = 'on' "
        f"OR {column} = current_setting('app.current_household', true)::uuid"
    )


# Tables whose tenant-isolation policy we recreate with the empty-safe predicate.
_RECREATE_POLICIES: list[tuple[str, str]] = [
    ("households", "id"),
    ("memberships", "household_id"),
]


def _recreate_policy(table: str, column: str, predicate_fn) -> None:  # type: ignore[no-untyped-def]
    op.execute(f"DROP POLICY IF EXISTS {table}_tenant_isolation ON {table}")
    predicate = predicate_fn(column)
    op.execute(
        f"CREATE POLICY {table}_tenant_isolation ON {table} "
        f"USING ({predicate}) WITH CHECK ({predicate})"
    )


def upgrade() -> None:
    # refresh_tokens carries the active household so refresh() preserves a switch
    # (SET NULL on household delete — the session simply loses its active tenant).
    op.add_column("refresh_tokens", sa.Column("household_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        op.f("fk_refresh_tokens_household_id_households"),
        "refresh_tokens",
        "households",
        ["household_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "invitations",
        sa.Column("household_id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("role_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("invited_by", sa.UUID(), nullable=True),
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
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
            ["invited_by"],
            ["users.id"],
            name=op.f("fk_invitations_invited_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_invitations")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_invitations_token_hash")),
    )
    op.create_index("ix_invitations_household_id", "invitations", ["household_id"], unique=False)
    # One live (pending) invite per (household, email). Accepted/revoked rows are excluded so
    # a fresh invite after revoke/accept is allowed.
    op.create_index(
        "uq_invitations_pending_email",
        "invitations",
        ["household_id", "email"],
        unique=True,
        postgresql_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
    )

    op.execute("ALTER TABLE invitations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE invitations FORCE ROW LEVEL SECURITY")
    _recreate_policy("invitations", "household_id", _predicate)

    # Repair the latent ''::uuid bug in the pre-existing policies.
    for table, column in _RECREATE_POLICIES:
        _recreate_policy(table, column, _predicate)


def downgrade() -> None:
    # Restore the original (unguarded) predicate on the pre-existing tables.
    for table, column in _RECREATE_POLICIES:
        _recreate_policy(table, column, _legacy_predicate)

    op.drop_table("invitations")  # invitations RLS policy drops with the table
    op.drop_constraint(
        op.f("fk_refresh_tokens_household_id_households"), "refresh_tokens", type_="foreignkey"
    )
    op.drop_column("refresh_tokens", "household_id")
