"""Application factory (plan §3.1, §14).

Responsibilities: load config by ``APP_ENV``; build the APIFlask app with OpenAPI docs
gated by ``ENABLE_API_DOCS`` (off in prod, spec §7.4); wire ``ProxyFix`` (plan §3.4) so
the app trusts ``X-Forwarded-Proto: https`` from nginx; init DB/limiter/services;
register the unified error envelope, structured logging and blueprints.

The APScheduler is intentionally NOT started here — it runs only in the worker process
(plan §12.5) to avoid double-scheduling across web workers.
"""

from __future__ import annotations

from apiflask import APIFlask
from dotenv import load_dotenv
from flask import render_template_string
from werkzeug.middleware.proxy_fix import ProxyFix

from app.api import register_blueprints
from app.config import get_config
from app.db.session import db
from app.errors import register_error_handlers
from app.extensions import init_services, limiter
from app.logging_config import bind_request_context, configure_logging

_REDOC_HTML = """<!DOCTYPE html><html><head><title>HomeOps API — ReDoc</title>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
</head><body><redoc spec-url="{{ spec_url }}"></redoc>
<script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body></html>"""


def create_app(overrides: dict | None = None) -> APIFlask:
    load_dotenv()  # picks up backend/.env or repo-root .env when present
    cfg = get_config()

    enable_docs = (overrides or {}).get("ENABLE_API_DOCS", cfg.ENABLE_API_DOCS)

    app = APIFlask(
        __name__,
        title="HomeOps API",
        version="0.1.0",
        spec_path="/api/openapi.json" if enable_docs else None,
        docs_path="/api/docs" if enable_docs else None,
    )
    app.description = (
        "HomeOps backend API — household management SaaS (payments, documents, obligations)."
    )
    app.tags = [
        {
            "name": "Auth",
            "description": "Registration, activation, login and refresh-token lifecycle.",
        },
        {"name": "System", "description": "Health and readiness probes."},
        {"name": "Users", "description": "Public user resources (avatar image serving)."},
    ]
    app.config.from_object(cfg)
    app.config["SECRET_KEY"] = cfg.JWT_SECRET_KEY
    # Cap request bodies so an oversized avatar upload can't be read into memory before the
    # service-level check runs (a small headroom over the avatar cap covers multipart overhead).
    app.config["MAX_CONTENT_LENGTH"] = cfg.AVATAR_MAX_UPLOAD_BYTES + 1024 * 1024
    if overrides:
        app.config.update(overrides)

    # Trust the reverse proxy's forwarded headers (plan §3.4): correct https scheme in
    # generated links and correct Secure cookie behaviour behind nginx.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)  # type: ignore[method-assign]

    configure_logging(debug=app.config["DEBUG"])

    db.init_app(app)
    init_services(app)
    limiter.init_app(app)  # reads RATELIMIT_STORAGE_URI from app.config

    register_error_handlers(app)
    register_blueprints(app)

    @app.before_request
    def _before_request() -> None:
        bind_request_context()

    if enable_docs:

        @app.get("/api/redoc")
        @app.doc(hide=True)  # keep the docs page itself out of the generated spec
        def redoc() -> str:
            return render_template_string(_REDOC_HTML, spec_url="/api/openapi.json")

    return app
