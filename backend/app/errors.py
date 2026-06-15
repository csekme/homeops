"""Unified JSON error envelope (plan §3.1 DRY).

Every error — APIFlask validation failures, raised ``HTTPError`` / ``abort``, and
uncaught exceptions — comes back in one shape:

    {"error": {"code": <int>, "message": <str>, "detail": <optional>}}
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from apiflask import APIFlask


def register_error_handlers(app: APIFlask) -> None:
    @app.error_processor
    def _envelope(error: Any) -> tuple[dict[str, Any], int, dict[str, str]]:
        # APIFlask passes its HTTPError; shape it into our envelope.
        body: dict[str, Any] = {
            "error": {
                "code": error.status_code,
                "message": error.message,
            }
        }
        if error.detail:
            body["error"]["detail"] = error.detail
        return body, error.status_code, error.headers or {}
