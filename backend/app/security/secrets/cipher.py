"""Envelope-encryption seam (plan §10.5, spec §7.3) — the "crown jewels" interface.

``SecretCipher`` is the port every connector/secret will go through. The MVP adapter
(``EnvelopeAesCipher`` + ``EnvKeyProvider``) keeps the KEK in an env var; the Phase 4
KMS/Vault adapter drops in behind the same port with no caller change.

Envelope scheme:
- a fresh per-secret **DEK** (data key) encrypts the plaintext (AES-256-GCM, random nonce);
- the **KEK** (key-encrypting key) wraps the DEK (AES-256-GCM, random nonce);
- only the ciphertext + wrapped DEK are persisted; the KEK never touches the DB.

Key rotation re-wraps the DEKs under a new KEK without re-encrypting the secrets.
No adapter ever logs, returns, or raises with plaintext.
"""

from __future__ import annotations

import base64
import os
from dataclasses import dataclass
from typing import Protocol

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_KEY_LEN = 32  # AES-256
_NONCE_LEN = 12


@dataclass(frozen=True)
class SealedSecret:
    """Persistable result: GCM ciphertext + the KEK-wrapped DEK, plus the KEK id."""

    ciphertext: bytes
    wrapped_dek: bytes
    kek_id: str


class KeyProvider(Protocol):
    """Supplies KEKs. Swappable for a KMS/Vault-backed provider in Phase 4."""

    @property
    def active_kek_id(self) -> str: ...

    def kek(self, kek_id: str) -> bytes: ...


class SecretCipher(Protocol):
    def encrypt(self, plaintext: bytes) -> SealedSecret: ...

    def decrypt(self, sealed: SealedSecret) -> bytes: ...


class EnvKeyProvider:
    """MVP KEK source: a base64-encoded 32-byte key from an env var (plan §10.5)."""

    def __init__(self, *, kek_b64: str, kek_id: str = "env-v1") -> None:
        kek = base64.b64decode(kek_b64)
        if len(kek) != _KEY_LEN:
            raise ValueError("SECRET_KEK must decode to 32 bytes (AES-256).")
        self._kek = kek
        self._kek_id = kek_id

    @classmethod
    def from_env(cls, env_var: str = "SECRET_KEK", kek_id: str = "env-v1") -> EnvKeyProvider:
        value = os.environ.get(env_var)
        if not value:
            raise ValueError(f"{env_var} is not set.")
        return cls(kek_b64=value, kek_id=kek_id)

    @property
    def active_kek_id(self) -> str:
        return self._kek_id

    def kek(self, kek_id: str) -> bytes:
        if kek_id != self._kek_id:
            raise KeyError(f"unknown kek_id: {kek_id}")
        return self._kek


class EnvelopeAesCipher:
    """AES-256-GCM envelope cipher behind the ``SecretCipher`` port."""

    def __init__(self, key_provider: KeyProvider) -> None:
        self._keys = key_provider

    def encrypt(self, plaintext: bytes) -> SealedSecret:
        dek = AESGCM.generate_key(bit_length=256)
        data_nonce = os.urandom(_NONCE_LEN)
        ciphertext = data_nonce + AESGCM(dek).encrypt(data_nonce, plaintext, None)

        kek_id = self._keys.active_kek_id
        kek = self._keys.kek(kek_id)
        key_nonce = os.urandom(_NONCE_LEN)
        wrapped_dek = key_nonce + AESGCM(kek).encrypt(key_nonce, dek, None)

        return SealedSecret(ciphertext=ciphertext, wrapped_dek=wrapped_dek, kek_id=kek_id)

    def decrypt(self, sealed: SealedSecret) -> bytes:
        kek = self._keys.kek(sealed.kek_id)
        key_nonce, wrapped = sealed.wrapped_dek[:_NONCE_LEN], sealed.wrapped_dek[_NONCE_LEN:]
        dek = AESGCM(kek).decrypt(key_nonce, wrapped, None)

        data_nonce, body = sealed.ciphertext[:_NONCE_LEN], sealed.ciphertext[_NONCE_LEN:]
        return AESGCM(dek).decrypt(data_nonce, body, None)

    def rewrap(self, sealed: SealedSecret) -> SealedSecret:
        """KEK rotation: unwrap the DEK and re-wrap it under the active KEK.

        The secret ciphertext is untouched — only the wrapped DEK changes.
        """
        kek = self._keys.kek(sealed.kek_id)
        key_nonce, wrapped = sealed.wrapped_dek[:_NONCE_LEN], sealed.wrapped_dek[_NONCE_LEN:]
        dek = AESGCM(kek).decrypt(key_nonce, wrapped, None)

        new_id = self._keys.active_kek_id
        new_kek = self._keys.kek(new_id)
        new_nonce = os.urandom(_NONCE_LEN)
        new_wrapped = new_nonce + AESGCM(new_kek).encrypt(new_nonce, dek, None)
        return SealedSecret(ciphertext=sealed.ciphertext, wrapped_dek=new_wrapped, kek_id=new_id)
