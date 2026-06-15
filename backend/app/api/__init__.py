"""API layer: thin APIFlask blueprints (spec §5.3). Controllers validate + delegate."""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from apiflask import APIFlask


def register_blueprints(app: APIFlask) -> None:
    from app.api.auth import auth_bp
    from app.api.health import health_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
