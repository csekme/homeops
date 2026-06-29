"""Public user endpoints (feature plan §Avatar).

Currently just the avatar image server. The bytes are **unauthenticated** by design: a plain
``<img>`` / ``<Image>`` can't carry the in-memory bearer token, and the URL is keyed by an
unguessable user UUID. Household members can therefore see each other's pictures, and the
``?v=`` cache-buster (from ``avatar_updated_at``) makes every change a fresh URL.
"""

from __future__ import annotations

import uuid

from apiflask import APIBlueprint, abort
from flask import Response

from app.services import avatar_service

users_bp = APIBlueprint("users", __name__, url_prefix="/api/users")

# Long max-age is safe because the URL changes on every upload (``?v=``); the resource at a
# given URL is immutable.
_CACHE_CONTROL = "public, max-age=31536000, immutable"


@users_bp.get("/<uuid:user_id>/avatar")
@users_bp.doc(
    summary="Serve a user's profile picture (public, cache-busted by ?v=).",
    operation_id="getUserAvatar",
    tags=["Users"],
)
def get_user_avatar(user_id: uuid.UUID) -> Response:
    obj = avatar_service.load_avatar(user_id=user_id)
    if obj is None:
        abort(404, "No avatar.")
    resp = Response(obj.data, mimetype=obj.content_type)
    resp.headers["Cache-Control"] = _CACHE_CONTROL
    return resp
