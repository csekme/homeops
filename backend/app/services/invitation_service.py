"""Household invitation service (feature plan §Backend).

Create / list / resend / revoke run in the inviter's **tenant** scope (RLS keys on
``household_id``) and require the ``member.invite`` permission. **Acceptance and preview run
in no-tenant mode** because the invitee is not yet a member — RLS would otherwise hide the
invitation and reject the membership insert. The compensating control there is the
**email-binding check**: the authenticated user's email must equal the invited address.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from flask import current_app
from sqlalchemy.orm import Session

from app.db.models import Invitation, User
from app.db.rls import session_scope
from app.extensions import get_email_sender
from app.logging_config import get_logger
from app.notifications.email.messages import build_invitation_email
from app.repositories import households as households_repo
from app.repositories import invitations as invitations_repo
from app.repositories import memberships as membership_repo
from app.repositories import roles as roles_repo
from app.repositories import users as user_repo
from app.security import refresh_tokens
from app.services import authorization
from app.services.exceptions import (
    AlreadyMember,
    HouseholdNotFound,
    InvalidInvitation,
    InvitationEmailMismatch,
    NotAMember,
    PendingInviteExists,
)
from app.services.household_service import HouseholdView, SwitchResult, mint_access_token

log = get_logger("homeops.invitation")


@dataclass(frozen=True)
class InvitationView:
    id: str
    email: str
    role: str
    expires_at: str
    created_at: str


@dataclass(frozen=True)
class InvitationPreview:
    household_name: str
    role: str
    email: str


@dataclass(frozen=True)
class MyInvitationView:
    """A pending invitation as seen by its recipient on the dashboard (feature plan §#4).

    Identified by ``id`` (not the raw token, which lives only in the email) — accept/decline
    from the dashboard act by id, guarded by the same email-binding check as token accept.
    """

    id: str
    household_name: str
    role: str
    email: str
    expires_at: str
    created_at: str


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _view(invitation: Invitation) -> InvitationView:
    return InvitationView(
        id=str(invitation.id),
        email=invitation.email,
        role=invitation.role.name,
        expires_at=_as_utc(invitation.expires_at).isoformat(),
        created_at=_as_utc(invitation.created_at).isoformat(),
    )


def _send_invite_email(*, email: str, raw_token: str, household_name: str, locale: str) -> None:
    cfg = current_app.config
    invite_url = f"{cfg['PUBLIC_BASE_URL']}/invite/{raw_token}"
    get_email_sender().send(
        build_invitation_email(
            to=email,
            invite_url=invite_url,
            household_name=household_name,
            locale=locale or cfg["MAIL_DEFAULT_LOCALE"],
        )
    )


def invite(
    *,
    actor_id: uuid.UUID | str,
    household_id: uuid.UUID | str,
    email: str,
    role: str,
    locale: str | None = None,
) -> InvitationView:
    """Create a pending invitation and email the link (tenant scope, ``member.invite``).

    Rejects inviting someone who is already a member, or a duplicate pending invite.
    """
    email = email.strip().lower()
    cfg = current_app.config
    with session_scope(household_id=household_id) as session:
        authorization.require_permission(
            session, user_id=actor_id, household_id=household_id, permission="member.invite"
        )

        household = households_repo.get_by_id(session, household_id)
        if household is None:
            raise HouseholdNotFound("household not found")

        # Already a member? (users table is not RLS; membership lookup is in this tenant.)
        existing_user = user_repo.get_by_email(session, email)
        if existing_user is not None and (
            membership_repo.get(session, user_id=existing_user.id, household_id=household_id)
            is not None
        ):
            raise AlreadyMember("user is already a member of this household")

        if invitations_repo.find_pending_for_email(
            session, household_id=household_id, email=email
        ) is not None:
            raise PendingInviteExists("a pending invitation already exists for this email")

        role_obj = roles_repo.get_by_name(session, role)
        if role_obj is None:  # pragma: no cover — role is schema-validated
            raise HouseholdNotFound("unknown role")

        raw_token = secrets.token_urlsafe(32)
        invitation = invitations_repo.create(
            session,
            household_id=household_id,
            email=email,
            role_id=role_obj.id,
            token_hash=_hash(raw_token),
            expires_at=datetime.now(UTC)
            + timedelta(hours=cfg["INVITATION_TOKEN_TTL_HOURS"]),
            invited_by=actor_id,
        )
        # role isn't auto-loaded on the freshly built row — attach for the view.
        invitation.role = role_obj
        _send_invite_email(
            email=email,
            raw_token=raw_token,
            household_name=household.name,
            locale=locale or cfg["MAIL_DEFAULT_LOCALE"],
        )
        log.info(
            "invitation.created", household_id=str(household_id), invitation_id=str(invitation.id)
        )
        return _view(invitation)


def list_pending(
    *, user_id: uuid.UUID | str, household_id: uuid.UUID | str
) -> list[InvitationView]:
    with session_scope(household_id=household_id) as session:
        authorization.require_permission(
            session, user_id=user_id, household_id=household_id, permission="member.invite"
        )
        return [_view(inv) for inv in invitations_repo.list_pending(session, household_id)]


def resend(
    *,
    actor_id: uuid.UUID | str,
    household_id: uuid.UUID | str,
    invitation_id: uuid.UUID | str,
    locale: str | None = None,
) -> InvitationView:
    """Re-issue the token (new value + expiry) on a pending invitation and re-send the email."""
    cfg = current_app.config
    with session_scope(household_id=household_id) as session:
        authorization.require_permission(
            session, user_id=actor_id, household_id=household_id, permission="member.invite"
        )
        invitation = invitations_repo.get_by_id(session, invitation_id)
        if (
            invitation is None
            or str(invitation.household_id) != str(household_id)
            or invitation.accepted_at is not None
            or invitation.revoked_at is not None
        ):
            raise InvalidInvitation("invitation not found or no longer pending")

        household = households_repo.get_by_id(session, household_id)
        if household is None:
            raise HouseholdNotFound("household not found")

        raw_token = secrets.token_urlsafe(32)
        invitations_repo.set_token(
            session,
            invitation,
            token_hash=_hash(raw_token),
            expires_at=datetime.now(UTC) + timedelta(hours=cfg["INVITATION_TOKEN_TTL_HOURS"]),
        )
        _send_invite_email(
            email=invitation.email,
            raw_token=raw_token,
            household_name=household.name,
            locale=locale or cfg["MAIL_DEFAULT_LOCALE"],
        )
        return _view(invitation)


def revoke(
    *,
    actor_id: uuid.UUID | str,
    household_id: uuid.UUID | str,
    invitation_id: uuid.UUID | str,
) -> None:
    with session_scope(household_id=household_id) as session:
        authorization.require_permission(
            session, user_id=actor_id, household_id=household_id, permission="member.invite"
        )
        invitation = invitations_repo.get_by_id(session, invitation_id)
        if invitation is None or str(invitation.household_id) != str(household_id):
            raise InvalidInvitation("invitation not found")
        if invitation.accepted_at is not None or invitation.revoked_at is not None:
            raise InvalidInvitation("invitation is no longer pending")
        invitations_repo.revoke(session, invitation)
        log.info("invitation.revoked", invitation_id=str(invitation_id))


def _validate_pending(invitation: Invitation | None) -> Invitation:
    """Assert the invitation exists and is still pending, returning it (narrows Optional)."""
    if (
        invitation is None
        or invitation.accepted_at is not None
        or invitation.revoked_at is not None
        or invitation.declined_at is not None
    ):
        raise InvalidInvitation("invalid or already-used invitation")
    if _as_utc(invitation.expires_at) <= datetime.now(UTC):
        raise InvalidInvitation("expired invitation")
    return invitation


def preview(*, raw_token: str) -> InvitationPreview:
    """Public-ish preview of a pending invitation (no-tenant). Minimal info only."""
    with session_scope(bypass_tenant=True) as session:
        invitation = _validate_pending(
            invitations_repo.get_by_token_hash(session, _hash(raw_token))
        )
        household = households_repo.get_by_id(session, invitation.household_id)
        if household is None:
            raise InvalidInvitation("household no longer exists")
        return InvitationPreview(
            household_name=household.name,
            role=invitation.role.name,
            email=invitation.email,
        )


def _my_view(invitation: Invitation) -> MyInvitationView:
    return MyInvitationView(
        id=str(invitation.id),
        household_name=invitation.household.name,
        role=invitation.role.name,
        email=invitation.email,
        expires_at=_as_utc(invitation.expires_at).isoformat(),
        created_at=_as_utc(invitation.created_at).isoformat(),
    )


def list_mine(*, user_id: uuid.UUID | str) -> list[MyInvitationView]:
    """Pending invitations addressed to the caller's email, across households (feature plan §#4).

    No-tenant mode (cross-household read keyed on the user's own email, the same model as the
    accept flow). Solves the "empty dashboard after registering" gap: an invite that was
    waiting in the inbox shows up here without needing the email's token.
    """
    with session_scope(bypass_tenant=True) as session:
        user = user_repo.get_by_id(session, user_id)
        if user is None:  # pragma: no cover — bearer guard guarantees a real user
            raise NotAMember("user not found")
        return [
            _my_view(inv) for inv in invitations_repo.list_pending_for_email(session, user.email)
        ]


def _require_recipient(invitation: Invitation, user: User | None) -> User:
    """The email-binding gate shared by accept/decline (replaces RLS in no-tenant mode).

    Returns the (narrowed) recipient on success so callers keep a non-Optional ``User``.
    """
    if user is None:  # pragma: no cover — bearer guard guarantees a real user
        raise NotAMember("user not found")
    if user.email.strip().lower() != invitation.email.strip().lower():
        raise InvitationEmailMismatch("invitation was issued to a different email")
    return user


def accept(
    *,
    user_id: uuid.UUID | str,
    raw_token: str | None = None,
    invitation_id: uuid.UUID | str | None = None,
) -> SwitchResult:
    """Consume an invitation, create the membership, and auto-switch into the household.

    Resolved either by the emailed ``raw_token`` (invite-link page) or by ``invitation_id``
    (dashboard "my invitations", where the raw token isn't available). No-tenant mode: the
    invitee isn't a member yet, so RLS can't guard this — the **email-binding check**
    (accepting user's email == invited email) is the security gate. Idempotent: an
    already-existing membership is treated as success.
    """
    with session_scope(bypass_tenant=True) as session:
        invitation = _resolve_pending(session, raw_token=raw_token, invitation_id=invitation_id)

        user = _require_recipient(invitation, user_repo.get_by_id(session, user_id))

        household = households_repo.get_by_id(session, invitation.household_id)
        if household is None:
            raise InvalidInvitation("household no longer exists")

        existing = membership_repo.get(
            session, user_id=user.id, household_id=invitation.household_id
        )
        role_name = (
            existing.role.name
            if existing is not None
            else invitation.role.name
        )
        if existing is None:
            membership_repo.add(
                session,
                user_id=user.id,
                household_id=invitation.household_id,
                role_id=invitation.role_id,
            )
        invitations_repo.mark_accepted(session, invitation)

        refresh_tokens.set_active_household(
            session, user_id=user.id, household_id=invitation.household_id
        )
        access = mint_access_token(
            user_id=user.id, household_id=invitation.household_id, role=role_name
        )
        log.info(
            "invitation.accepted",
            user_id=str(user.id),
            household_id=str(invitation.household_id),
        )
        return SwitchResult(
            access_token=access,
            household=HouseholdView(
                id=str(household.id),
                name=household.name,
                default_currency=household.default_currency,
                role=role_name,
            ),
        )


def decline(
    *,
    user_id: uuid.UUID | str,
    raw_token: str | None = None,
    invitation_id: uuid.UUID | str | None = None,
) -> None:
    """Reject a pending invitation addressed to the caller (feature plan §#4).

    Resolved by the emailed ``raw_token`` (invite-link page) or by ``invitation_id``
    (dashboard "my invitations") — symmetric with ``accept``. No-tenant mode + email-binding
    check. Marks ``declined_at`` (distinct from the inviter-side ``revoked_at``), which frees
    the (household, email) slot for a re-invite.
    """
    with session_scope(bypass_tenant=True) as session:
        invitation = _resolve_pending(session, raw_token=raw_token, invitation_id=invitation_id)
        user = _require_recipient(invitation, user_repo.get_by_id(session, user_id))
        invitations_repo.mark_declined(session, invitation)
        log.info(
            "invitation.declined", user_id=str(user.id), invitation_id=str(invitation.id)
        )


def _resolve_pending(
    session: Session,
    *,
    raw_token: str | None = None,
    invitation_id: uuid.UUID | str | None = None,
) -> Invitation:
    """Resolve a still-pending invitation by token or id (exactly one must be given)."""
    if raw_token is not None:
        return _validate_pending(invitations_repo.get_by_token_hash(session, _hash(raw_token)))
    if invitation_id is not None:
        return _validate_pending(invitations_repo.get_full_by_id(session, invitation_id))
    raise InvalidInvitation("no invitation identifier supplied")
