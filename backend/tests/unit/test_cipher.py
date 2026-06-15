import base64

import pytest
from cryptography.exceptions import InvalidTag

from app.security.secrets import EnvelopeAesCipher, EnvKeyProvider

_KEK_B64 = base64.b64encode(b"unit_test_kek_0123456789abcdef!!").decode()  # 32 bytes


def _cipher() -> EnvelopeAesCipher:
    return EnvelopeAesCipher(EnvKeyProvider(kek_b64=_KEK_B64, kek_id="v1"))


def test_round_trip() -> None:
    cipher = _cipher()
    sealed = cipher.encrypt(b"oauth-refresh-token")
    assert cipher.decrypt(sealed) == b"oauth-refresh-token"


def test_ciphertext_never_contains_plaintext() -> None:
    sealed = _cipher().encrypt(b"super-secret-value")
    assert b"super-secret-value" not in sealed.ciphertext
    assert b"super-secret-value" not in sealed.wrapped_dek


def test_tampered_ciphertext_fails() -> None:
    cipher = _cipher()
    sealed = cipher.encrypt(b"data")
    tampered = type(sealed)(
        ciphertext=sealed.ciphertext[:-1] + bytes([sealed.ciphertext[-1] ^ 0x01]),
        wrapped_dek=sealed.wrapped_dek,
        kek_id=sealed.kek_id,
    )
    with pytest.raises(InvalidTag):
        cipher.decrypt(tampered)


def test_kek_must_be_32_bytes() -> None:
    with pytest.raises(ValueError):
        EnvKeyProvider(kek_b64=base64.b64encode(b"too-short").decode())


def test_rewrap_keeps_plaintext_recoverable() -> None:
    cipher = _cipher()
    sealed = cipher.encrypt(b"rotate-me")
    rewrapped = cipher.rewrap(sealed)
    # Ciphertext (the expensive part) is untouched; only the wrapped DEK changes.
    assert rewrapped.ciphertext == sealed.ciphertext
    assert rewrapped.wrapped_dek != sealed.wrapped_dek
    assert cipher.decrypt(rewrapped) == b"rotate-me"
