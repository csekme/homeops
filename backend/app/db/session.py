"""Engine + session factory (plan §3.3).

The app connects with a NON-superuser, NON-``BYPASSRLS`` role so the RLS policies in
``app/db/rls.py`` are actually enforced (a superuser would silently bypass them — the
classic mistake called out in plan §3.6). Migrations use a separate privileged URL.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

if TYPE_CHECKING:
    from apiflask import APIFlask
    from sqlalchemy.engine import Engine


class Database:
    """Holds the engine and session factory, initialised from app config."""

    def __init__(self) -> None:
        self.engine: Engine | None = None
        self.session_factory: sessionmaker[Session] | None = None

    def init_app(self, app: APIFlask) -> None:
        self.engine = create_engine(
            app.config["DATABASE_URL"],
            pool_pre_ping=True,
            future=True,
        )
        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False, future=True)
        app.extensions["database"] = self

    def new_session(self) -> Session:
        if self.session_factory is None:
            raise RuntimeError("Database.init_app() was not called.")
        return self.session_factory()


db = Database()
