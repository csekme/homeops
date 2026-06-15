"""Argon2id password hashing (plan §3.5a).

Parameters come from config (memory cost ≥ 64 MiB by default). ``needs_rehash`` lets the
service transparently upgrade hashes when parameters change.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError


class Passwords:
    def __init__(
        self,
        *,
        memory_cost: int = 65536,
        time_cost: int = 3,
        parallelism: int = 2,
    ) -> None:
        # argon2-cffi's PasswordHasher defaults to the Argon2id type.
        self._hasher = PasswordHasher(
            memory_cost=memory_cost,
            time_cost=time_cost,
            parallelism=parallelism,
        )

    def hash(self, password: str) -> str:
        return self._hasher.hash(password)

    def verify(self, password_hash: str, password: str) -> bool:
        try:
            return self._hasher.verify(password_hash, password)
        except (VerifyMismatchError, InvalidHashError):
            return False

    def needs_rehash(self, password_hash: str) -> bool:
        return self._hasher.check_needs_rehash(password_hash)
