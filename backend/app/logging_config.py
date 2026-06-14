"""Structured logging (spec §4, §11): JSON lines carrying ``request_id`` /
``household_id`` / ``user_id`` — and **never** secrets or PII (redaction filter).

Phase 0 wires the structlog pipeline + a request-id binding. The richer audit fields and
metrics follow in later phases; the redaction processor is here from day one.
"""

from __future__ import annotations

import logging
import uuid

import structlog
from flask import g, request
from structlog.types import EventDict, WrappedLogger

# Keys whose values must never be logged in full (plan §11, spec §7.4 Logging).
_REDACT_KEYS = {
    "password",
    "password_hash",
    "token",
    "raw_token",
    "refresh_token",
    "access_token",
    "csrf_token",
    "authorization",
    "secret",
    "secret_kek",
    "wrapped_dek",
}


def _redact(_logger: WrappedLogger, _method: str, event_dict: EventDict) -> EventDict:
    for key in list(event_dict.keys()):
        if key.lower() in _REDACT_KEYS:
            event_dict[key] = "***redacted***"
    return event_dict


def configure_logging(*, debug: bool) -> None:
    renderer = structlog.dev.ConsoleRenderer() if debug else structlog.processors.JSONRenderer()
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            _redact,
            structlog.processors.StackInfoRenderer(),
            renderer,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.DEBUG if debug else logging.INFO
        ),
        cache_logger_on_first_use=True,
    )


def bind_request_context() -> None:
    """Bind a per-request ``request_id`` (and later household/user) to the log context."""
    structlog.contextvars.clear_contextvars()
    request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
    g.request_id = request_id
    structlog.contextvars.bind_contextvars(request_id=request_id)


def get_logger(name: str = "homeops") -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(name)
