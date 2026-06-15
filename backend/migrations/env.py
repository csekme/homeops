"""Alembic environment (plan §3.3).

Runs with the privileged ``MIGRATION_DATABASE_URL`` (owner role) so it can enable RLS,
create the non-privileged app role and grant it table access. ``target_metadata`` is the
app's ``Base.metadata`` so ``alembic check`` (autogen drift) is meaningful.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool

# Ensure all models are imported so they register on Base.metadata.
from app.db import models as _models  # noqa: F401
from app.db.base import Base

load_dotenv()

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

_url = os.environ.get("MIGRATION_DATABASE_URL") or os.environ.get(
    "DATABASE_URL",
    "postgresql+psycopg://homeops:homeops@localhost:5432/homeops",
)
config.set_main_option("sqlalchemy.url", _url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
