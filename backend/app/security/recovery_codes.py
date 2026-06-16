"""Recovery (backup) codes for 2FA (feature plan §Backend.5).

Human-readable, high-entropy one-time codes shown **once** at enrolment. Only their
SHA-256 hash is persisted (the same hash-only treatment as refresh/activation tokens),
so a leaked DB never yields a usable code.
"""

from __future__ import annotations

import hashlib
import secrets

DEFAULT_COUNT = 10

# Unambiguous alphabet (no 0/O/1/I/L) for codes the user may copy by hand.
_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
_GROUPS = 3
_GROUP_LEN = 4


def hash_code(raw: str) -> str:
    """SHA-256 hex digest of a normalized code (lowercased, dashes/spaces stripped)."""
    return hashlib.sha256(normalize(raw).encode("utf-8")).hexdigest()


def normalize(raw: str) -> str:
    """Canonical form for comparison: lowercase, no separators/whitespace."""
    return raw.strip().lower().replace("-", "").replace(" ", "")


def generate(n: int = DEFAULT_COUNT) -> list[str]:
    """``n`` formatted codes, e.g. ``"a3kf-9p2m-7xqd"`` (12 chars of entropy + dashes)."""
    return [_one() for _ in range(n)]


def _one() -> str:
    groups = [
        "".join(secrets.choice(_ALPHABET) for _ in range(_GROUP_LEN)) for _ in range(_GROUPS)
    ]
    return "-".join(groups)
