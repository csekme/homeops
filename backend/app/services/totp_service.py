"""Two-factor (TOTP) business logic (feature plan §Backend.6).

All 2FA tables are user-scoped (no ``household_id``) → every unit of work runs in
no-tenant mode, exactly like ``auth_service``. The TOTP secret is envelope-encrypted at
rest via the shared ``SecretCipher``; the plaintext only ever exists transiently in
memory here and (once) in the setup response so the user can scan/type it.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.db.models import RecoveryCode, UserTotp
from app.db.rls import session_scope
from app.extensions import get_passwords, get_secret_cipher
from app.logging_config import get_logger
from app.repositories import users as user_repo
from app.security import recovery_codes, totp
from app.security.secrets import SealedSecret
from app.services.exceptions import (
    InvalidCredentials,
    InvalidTotpCode,
    TotpAlreadyEnabled,
    TotpNotConfigured,
    TotpReuse,
)

log = get_logger("homeops.totp")

RECOVERY_CODE_COUNT = recovery_codes.DEFAULT_COUNT


@dataclass(frozen=True)
class SetupView:
    provisioning_uri: str
    secret: str


@dataclass(frozen=True)
class StatusView:
    enabled: bool
    recovery_codes_remaining: int


def _seal(secret: str) -> SealedSecret:
    return get_secret_cipher().encrypt(secret.encode("utf-8"))


def _unseal(row: UserTotp) -> str:
    sealed = SealedSecret(
        ciphertext=row.secret_ciphertext,
        wrapped_dek=row.secret_wrapped_dek,
        kek_id=row.secret_kek_id,
    )
    return get_secret_cipher().decrypt(sealed).decode("utf-8")


def _get_totp(session: Session, user_id: uuid.UUID | str) -> UserTotp | None:
    return session.execute(
        select(UserTotp).where(UserTotp.user_id == uuid.UUID(str(user_id)))
    ).scalar_one_or_none()


def start_setup(*, user_id: uuid.UUID | str) -> SetupView:
    """Begin enrolment: store a fresh, **unconfirmed** encrypted secret and return the
    provisioning URI + base32 secret. Overwrites any prior unconfirmed attempt; refuses
    if 2FA is already enabled."""
    with session_scope(bypass_tenant=True) as session:
        user = user_repo.get_by_id(session, user_id)
        if user is None:
            raise TotpNotConfigured("unknown user")

        existing = _get_totp(session, user.id)
        if existing is not None and existing.enabled:
            raise TotpAlreadyEnabled("two-factor authentication is already enabled")

        secret = totp.generate_secret()
        sealed = _seal(secret)
        if existing is None:
            session.add(
                UserTotp(
                    user_id=user.id,
                    secret_ciphertext=sealed.ciphertext,
                    secret_wrapped_dek=sealed.wrapped_dek,
                    secret_kek_id=sealed.kek_id,
                )
            )
        else:
            existing.secret_ciphertext = sealed.ciphertext
            existing.secret_wrapped_dek = sealed.wrapped_dek
            existing.secret_kek_id = sealed.kek_id
            existing.confirmed_at = None
            existing.last_used_step = None

        log.info("totp.setup_started", user_id=str(user.id))
        return SetupView(
            provisioning_uri=totp.provisioning_uri(secret, user.email),
            secret=secret,
        )


def confirm_setup(*, user_id: uuid.UUID | str, code: str) -> list[str]:
    """Confirm enrolment with a valid code, then mint + return the recovery codes (once)."""
    with session_scope(bypass_tenant=True) as session:
        row = _get_totp(session, user_id)
        if row is None:
            raise TotpNotConfigured("two-factor setup has not been started")
        if row.enabled:
            raise TotpAlreadyEnabled("two-factor authentication is already enabled")

        step = totp.verify(_unseal(row), code)
        if step is None:
            raise InvalidTotpCode("invalid code")

        row.confirmed_at = datetime.now(UTC)
        # Bind the consuming step so the very same code can't be replayed at next login.
        row.last_used_step = step

        codes = _replace_recovery_codes(session, row.user_id)
        log.info("totp.enabled", user_id=str(row.user_id))
        return codes


def verify_challenge(session: Session, *, user_id: uuid.UUID | str, code: str) -> None:
    """Login step 2 (session-bound, runs inside the login transaction).

    Accepts a TOTP code (with replay protection via ``last_used_step``) **or** a single-use
    backup code. Raises ``InvalidTotpCode`` / ``TotpReuse`` on failure; returns on success.
    """
    row = _get_totp(session, user_id)
    if row is None or not row.enabled:
        raise TotpNotConfigured("two-factor authentication is not enabled")

    step = totp.verify(_unseal(row), code)
    if step is not None:
        if row.last_used_step is not None and step <= row.last_used_step:
            raise TotpReuse("this code was already used")
        row.last_used_step = step
        return

    if _consume_recovery_code(session, row.user_id, code):
        log.info("totp.recovery_code_used", user_id=str(row.user_id))
        return

    raise InvalidTotpCode("invalid code")


def disable(*, user_id: uuid.UUID | str, password: str) -> None:
    """Disable 2FA after re-verifying the password (step-up). Drops secret + recovery codes."""
    with session_scope(bypass_tenant=True) as session:
        row = _require_with_password(session, user_id, password)
        session.execute(delete(RecoveryCode).where(RecoveryCode.user_id == row.user_id))
        session.delete(row)
        log.info("totp.disabled", user_id=str(row.user_id))


def regenerate_recovery(*, user_id: uuid.UUID | str, password: str) -> list[str]:
    """Replace all recovery codes with a fresh set after re-verifying the password."""
    with session_scope(bypass_tenant=True) as session:
        row = _require_with_password(session, user_id, password)
        codes = _replace_recovery_codes(session, row.user_id)
        log.info("totp.recovery_regenerated", user_id=str(row.user_id))
        return codes


def status(*, user_id: uuid.UUID | str) -> StatusView:
    """Settings-page view: whether 2FA is enabled and how many backup codes remain."""
    with session_scope(bypass_tenant=True) as session:
        row = _get_totp(session, user_id)
        if row is None or not row.enabled:
            return StatusView(enabled=False, recovery_codes_remaining=0)
        remaining = session.execute(
            select(func.count())
            .select_from(RecoveryCode)
            .where(RecoveryCode.user_id == row.user_id, RecoveryCode.used_at.is_(None))
        ).scalar_one()
        return StatusView(enabled=True, recovery_codes_remaining=int(remaining))


def is_enabled(session: Session, user_id: uuid.UUID | str) -> bool:
    """Whether the user has a confirmed enrolment (used by the login branch)."""
    row = _get_totp(session, user_id)
    return row is not None and row.enabled


def _require_with_password(session: Session, user_id: uuid.UUID | str, password: str) -> UserTotp:
    user = user_repo.get_by_id(session, user_id)
    if user is None or not get_passwords().verify(user.password_hash, password):
        raise InvalidCredentials("invalid password")
    row = _get_totp(session, user.id)
    if row is None or not row.enabled:
        raise TotpNotConfigured("two-factor authentication is not enabled")
    return row


def _replace_recovery_codes(session: Session, user_id: uuid.UUID) -> list[str]:
    session.execute(delete(RecoveryCode).where(RecoveryCode.user_id == user_id))
    codes = recovery_codes.generate(RECOVERY_CODE_COUNT)
    for raw in codes:
        session.add(RecoveryCode(user_id=user_id, code_hash=recovery_codes.hash_code(raw)))
    return codes


def _consume_recovery_code(session: Session, user_id: uuid.UUID, code: str) -> bool:
    row = session.execute(
        select(RecoveryCode).where(
            RecoveryCode.user_id == user_id,
            RecoveryCode.code_hash == recovery_codes.hash_code(code),
            RecoveryCode.used_at.is_(None),
        )
    ).scalar_one_or_none()
    if row is None:
        return False
    row.used_at = datetime.now(UTC)
    return True
