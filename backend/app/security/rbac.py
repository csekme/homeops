"""RBAC helpers (spec §3.2, §7.2).

Phase 0 ships the seam; the enforcing engine — ``require_permission`` woven through every
service operation — is Phase 1 (plan §4.2). Kept tiny and dependency-free on purpose.
"""

from __future__ import annotations


def has_permission(permissions: list[str], permission: str) -> bool:
    return permission in permissions
