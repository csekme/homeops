"""invitation decline: invitations.declined_at + pending partial-index update

Adds the ``declined_at`` column that records an invitee *rejecting* an invitation
(feature plan §#4), distinct from the inviter-side ``revoked_at`` withdrawal. A declined
invite is no longer pending, so the partial unique index that enforces "one live invite per
(household, email)" is widened to also exclude declined rows — letting a fresh invite be
sent after a decline.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-26 09:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: str | None = "b2c3d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "invitations", sa.Column("declined_at", sa.DateTime(timezone=True), nullable=True)
    )
    # Recreate the pending partial index to also exclude declined rows, so a re-invite after
    # a decline is allowed (mirrors the model's Index definition).
    op.drop_index("uq_invitations_pending_email", table_name="invitations")
    op.create_index(
        "uq_invitations_pending_email",
        "invitations",
        ["household_id", "email"],
        unique=True,
        postgresql_where=sa.text(
            "accepted_at IS NULL AND revoked_at IS NULL AND declined_at IS NULL"
        ),
    )


def downgrade() -> None:
    op.drop_index("uq_invitations_pending_email", table_name="invitations")
    op.create_index(
        "uq_invitations_pending_email",
        "invitations",
        ["household_id", "email"],
        unique=True,
        postgresql_where=sa.text("accepted_at IS NULL AND revoked_at IS NULL"),
    )
    op.drop_column("invitations", "declined_at")
