"""Authentication service (plan §3.5) — register → activate → login → refresh → logout.

All auth lookups run in **no-tenant mode** (``bypass_tenant=True``) because they cross
households (e.g. "which households does this user belong to?"), which the RLS policies
would otherwise hide (plan §3.6). The active ``household_id``/``role`` for the access
token come from the user's membership — never from the client.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from flask import current_app
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import ActivationToken, User
from app.db.rls import session_scope
from app.domain.enums import UserStatus
from app.extensions import get_email_sender, get_passwords
from app.logging_config import get_logger
from app.notifications.email.messages import build_activation_email
from app.repositories import users as user_repo
from app.security import refresh_tokens
from app.security.csrf import issue_csrf_token
from app.security.jwt_tokens import decode_mfa_challenge, encode_access_token, encode_mfa_challenge
from app.services import totp_service
from app.services.exceptions import (
    AccountNotActivated,
    InvalidActivationToken,
    InvalidCredentials,
    InvalidRefreshSession,
    MfaRequired,
)

log = get_logger("homeops.auth")


@dataclass(frozen=True)
class IssuedSession:
    access_token: str
    refresh_token: str
    csrf_token: str
    user: User


@dataclass(frozen=True)
class TokenRefresh:
    access_token: str
    refresh_token: str
    csrf_token: str


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def register(*, email: str, password: str, display_name: str, locale: str | None = None) -> None:
    """Create a PENDING user and email a single-use activation link (plan §3.5b).

    Generic by design: if the email already exists we do nothing and the API still
    returns the same accepted response (no user enumeration, plan §3.5f).
    """
    email = email.strip().lower()
    cfg = current_app.config
    with session_scope(bypass_tenant=True) as session:
        if user_repo.get_by_email(session, email) is not None:
            log.info("register.duplicate_email_ignored")
            return

        user = User(
            email=email,
            password_hash=get_passwords().hash(password),
            display_name=display_name.strip(),
            status=UserStatus.PENDING.value,
        )
        user_repo.add(session, user)

        raw_token = secrets.token_urlsafe(32)
        session.add(
            ActivationToken(
                user_id=user.id,
                token_hash=_hash(raw_token),
                expires_at=datetime.now(UTC) + timedelta(hours=cfg["ACTIVATION_TOKEN_TTL_HOURS"]),
            )
        )
        session.flush()

        activation_url = f"{cfg['PUBLIC_BASE_URL']}/activate/{raw_token}"
        get_email_sender().send(
            build_activation_email(
                to=user.email,
                activation_url=activation_url,
                locale=locale or cfg["MAIL_DEFAULT_LOCALE"],
            )
        )
        log.info("register.activation_email_sent", user_id=str(user.id))


def activate(*, raw_token: str) -> None:
    """Consume a valid activation token and flip the user to ACTIVE (plan §3.5b)."""
    with session_scope(bypass_tenant=True) as session:
        token = session.execute(
            select(ActivationToken).where(ActivationToken.token_hash == _hash(raw_token))
        ).scalar_one_or_none()

        if token is None or token.used_at is not None:
            raise InvalidActivationToken("invalid or used activation token")
        if _as_utc(token.expires_at) <= datetime.now(UTC):
            raise InvalidActivationToken("expired activation token")

        user = user_repo.get_by_id(session, token.user_id)
        if user is None:
            raise InvalidActivationToken("invalid activation token")

        token.used_at = datetime.now(UTC)
        if user.status != UserStatus.ACTIVE.value:
            user.status = UserStatus.ACTIVE.value
            user.activated_at = datetime.now(UTC)
        log.info("activate.success", user_id=str(user.id))


def login(*, email: str, password: str, ip: str | None, user_agent: str | None) -> IssuedSession:
    """Verify credentials + ACTIVE status, then mint the token pair (plan §3.5c).

    Non-ACTIVE accounts are rejected (plan §3.5b → 403). Both the unknown-user and
    bad-password paths raise the same generic error (plan §3.5f).

    When the account has 2FA enabled the password check is *not* enough: instead of a
    session we raise ``MfaRequired`` carrying a short-lived challenge token; the client
    completes login via ``complete_login`` (feature plan §Backend.7).
    """
    email = email.strip().lower()
    cfg = current_app.config
    with session_scope(bypass_tenant=True) as session:
        user = user_repo.get_by_email(session, email)
        passwords = get_passwords()

        if user is None:
            # Burn comparable Argon2id work to blunt timing-based enumeration.
            passwords.hash(password)
            raise InvalidCredentials("invalid email or password")

        if not passwords.verify(user.password_hash, password):
            raise InvalidCredentials("invalid email or password")

        if user.status != UserStatus.ACTIVE.value:
            raise AccountNotActivated("account is not activated")

        if passwords.needs_rehash(user.password_hash):
            user.password_hash = passwords.hash(password)

        if totp_service.is_enabled(session, user.id):
            raise MfaRequired(
                encode_mfa_challenge(
                    user_id=user.id,
                    secret=cfg["JWT_SECRET_KEY"],
                    ttl_minutes=cfg["MFA_CHALLENGE_TTL_MINUTES"],
                )
            )

        return _issue_session(session, user, ip=ip, user_agent=user_agent)


def complete_login(
    *, challenge_token: str, code: str, ip: str | None, user_agent: str | None
) -> IssuedSession:
    """Login step 2: validate the challenge token + TOTP/backup code, then issue a session.

    May raise ``TokenError`` (bad/expired challenge), ``InvalidTotpCode``/``TotpReuse``
    (bad code), or ``TotpNotConfigured``. Verification and session issuance share one
    transaction so the consumed step / used backup code commit atomically with the session.
    """
    cfg = current_app.config
    claims = decode_mfa_challenge(challenge_token, secret=cfg["JWT_SECRET_KEY"])
    with session_scope(bypass_tenant=True) as session:
        user = user_repo.get_by_id(session, claims.sub)
        if user is None or user.status != UserStatus.ACTIVE.value:
            raise InvalidCredentials("invalid credentials")
        totp_service.verify_challenge(session, user_id=user.id, code=code)
        return _issue_session(session, user, ip=ip, user_agent=user_agent)


def refresh(*, raw_refresh: str, ip: str | None, user_agent: str | None) -> TokenRefresh:
    """Rotate the refresh token; on replay, raise after the family is revoked (plan §3.5d)."""
    cfg = current_app.config
    reuse: refresh_tokens.RefreshTokenReuse | None = None
    with session_scope(bypass_tenant=True) as session:
        try:
            issued = refresh_tokens.rotate(
                session,
                raw_token=raw_refresh,
                ttl_days=cfg["REFRESH_TOKEN_TTL_DAYS"],
                ip=ip,
                user_agent=user_agent,
            )
        except refresh_tokens.RefreshTokenReuse as exc:
            reuse = exc  # handled below in a fresh, committed transaction
        except refresh_tokens.InvalidRefreshToken as exc:
            raise InvalidRefreshSession("invalid refresh token") from exc
        else:
            user = user_repo.get_by_id(session, issued.record.user_id)
            if user is None or user.status != UserStatus.ACTIVE.value:
                raise InvalidRefreshSession("invalid refresh session")

            household_id, role = _active_membership(session, user.id)
            access = encode_access_token(
                user_id=user.id,
                secret=cfg["JWT_SECRET_KEY"],
                ttl_minutes=cfg["ACCESS_TOKEN_TTL_MINUTES"],
                household_id=household_id,
                role=role,
            )
            return TokenRefresh(
                access_token=access,
                refresh_token=issued.raw_token,
                csrf_token=issue_csrf_token(),
            )

    # Reuse detected: revoke the whole family in its own committed transaction, then 401.
    with session_scope(bypass_tenant=True) as revoke_session:
        refresh_tokens.revoke_family(revoke_session, reuse.family_id)
    log.warning(
        "refresh.reuse_detected",
        family_id=str(reuse.family_id),
        user_id=str(reuse.user_id),
    )
    raise InvalidRefreshSession("refresh token reuse detected")


def logout(*, raw_refresh: str | None) -> None:
    """Revoke the refresh family for the presented token (plan §3.5)."""
    if not raw_refresh:
        return
    with session_scope(bypass_tenant=True) as session:
        user_id = refresh_tokens.revoke(session, raw_token=raw_refresh)
        if user_id is not None:
            log.info("logout.success", user_id=str(user_id))


@dataclass(frozen=True)
class MembershipView:
    household_id: str
    household_name: str
    role: str


@dataclass(frozen=True)
class MeView:
    id: str
    email: str
    display_name: str
    status: str
    memberships: list[MembershipView]


def get_me(*, user_id: uuid.UUID | str) -> MeView | None:
    with session_scope(bypass_tenant=True) as session:
        user = user_repo.get_by_id(session, user_id)
        if user is None:
            return None
        memberships = [
            MembershipView(
                household_id=str(m.household_id),
                household_name=m.household.name,
                role=m.role.name,
            )
            for m in user_repo.list_memberships(session, user.id)
        ]
        return MeView(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            status=user.status,
            memberships=memberships,
        )


def _issue_session(
    session: Session, user: User, *, ip: str | None, user_agent: str | None
) -> IssuedSession:
    cfg = current_app.config
    household_id, role = _active_membership(session, user.id)
    access = encode_access_token(
        user_id=user.id,
        secret=cfg["JWT_SECRET_KEY"],
        ttl_minutes=cfg["ACCESS_TOKEN_TTL_MINUTES"],
        household_id=household_id,
        role=role,
    )
    issued = refresh_tokens.issue(
        session,
        user_id=user.id,
        ttl_days=cfg["REFRESH_TOKEN_TTL_DAYS"],
        ip=ip,
        user_agent=user_agent,
    )
    return IssuedSession(
        access_token=access,
        refresh_token=issued.raw_token,
        csrf_token=issue_csrf_token(),
        user=user,
    )


def _active_membership(session: Session, user_id: uuid.UUID) -> tuple[str | None, str | None]:
    """Pick the user's active household + role for the access-token claims.

    Phase 0 users have no household yet (households arrive in Phase 1), so this is
    typically ``(None, None)``; the code is ready for the multi-household switch.
    """
    memberships = user_repo.list_memberships(session, user_id)
    if not memberships:
        return None, None
    first = memberships[0]
    return str(first.household_id), first.role.name
