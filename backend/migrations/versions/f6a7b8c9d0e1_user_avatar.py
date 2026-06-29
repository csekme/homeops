"""user avatar: avatar_key + avatar_updated_at on users

Adds the profile-picture columns (feature plan §Avatar). User-scoped (no ``household_id``)
→ not subject to RLS, like the rest of the ``users`` table. ``avatar_key`` is the storage
key (NULL = no picture); ``avatar_updated_at`` doubles as the cache-buster for the public
``GET /api/users/{id}/avatar`` URL.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-06-29 10:00:00.000000
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: str | None = "e5f6a7b8c9d0"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_key", sa.String(length=255), nullable=True))
    op.add_column(
        "users", sa.Column("avatar_updated_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_updated_at")
    op.drop_column("users", "avatar_key")
