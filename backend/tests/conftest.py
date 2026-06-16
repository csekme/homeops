"""Integration test harness (plan §9): a real PostgreSQL 16 via Testcontainers.

The app connects as the non-privileged ``homeops_app`` role created by the migration, so
RLS is genuinely exercised (plan §3.6). Migrations run once as the privileged owner; each
test starts from a clean slate (roles kept, content truncated).
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

_BACKEND_DIR = Path(__file__).resolve().parent.parent
_MIGRATIONS = str(_BACKEND_DIR / "migrations")


@pytest.fixture(scope="session")
def _pg() -> Iterator[dict[str, str]]:
    try:
        from testcontainers.postgres import PostgresContainer
    except ImportError:  # pragma: no cover
        pytest.skip("testcontainers not installed")

    container = PostgresContainer(
        "postgres:16-alpine", username="homeops", password="homeops", dbname="homeops"
    )
    container.start()
    try:
        host = container.get_container_host_ip()
        port = container.get_exposed_port(5432)
        urls = {
            "migration": f"postgresql+psycopg://homeops:homeops@{host}:{port}/homeops",
            "app": f"postgresql+psycopg://homeops_app:homeops_app@{host}:{port}/homeops",
        }
        _run_migrations(urls["migration"])
        yield urls
    finally:
        container.stop()


def _run_migrations(migration_url: str) -> None:
    from alembic import command
    from alembic.config import Config as AlembicConfig

    os.environ["MIGRATION_DATABASE_URL"] = migration_url
    cfg = AlembicConfig()
    cfg.set_main_option("script_location", _MIGRATIONS)
    command.upgrade(cfg, "head")


@pytest.fixture(scope="session")
def _privileged_engine(_pg: dict[str, str]):
    engine = create_engine(_pg["migration"], future=True)
    yield engine
    engine.dispose()


@pytest.fixture(autouse=True)
def _clean_db(_pg: dict[str, str], _privileged_engine) -> None:
    with _privileged_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE users, households, memberships, invitations, obligations, "
                "refresh_tokens, activation_tokens, user_totp, recovery_codes "
                "RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def app(_pg: dict[str, str]):
    from app import create_app
    from app.notifications.email import MemoryEmailSender

    os.environ["APP_ENV"] = "testing"
    application = create_app({"DATABASE_URL": _pg["app"], "JWT_SECRET_KEY": "x" * 40})
    mailbox = MemoryEmailSender()
    application.extensions["email_sender"] = mailbox
    application.extensions["test_mailbox"] = mailbox
    return application


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def mailbox(app):
    return app.extensions["test_mailbox"]
