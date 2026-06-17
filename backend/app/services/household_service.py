"""Household, membership and invitation business logic (plan §4.3).

Tenant context per operation (plan §3.6):
- **No-tenant (bypass) mode** for boot/cross-household flows: creating the first household
  (it doesn't exist yet), listing the households a user belongs to, switching, and
  accepting an invitation (the invitee isn't a member yet, found by token).
- **Tenant mode** (``household_id`` from the *token*, never the body) for everything that
  acts inside one household: inviting, listing/managing members, deleting the household.

Every tenant-scoped mutation begins with ``require_permission`` (the RBAC gate, §4.2).
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from flask import current_app
from sqlalchemy.orm import Session

from app.db.models import Membership
from app.db.rls import session_scope
from app.domain.enums import Role as RoleEnum
from app.extensions import get_email_sender
from app.logging_config import get_logger
from app.notifications.email.messages import build_invitation_email
from app.repositories import households as household_repo
from app.repositories import invitations as invitation_repo
from app.repositories import memberships as membership_repo
from app.repositories import roles as role_repo
from app.security.jwt_tokens import encode_access_token
from app.security.rbac import MembershipContext, require_permission
from app.services import audit_service
from app.services.exceptions import (
    AlreadyMember,
    HouseholdNotFound,
    InvalidInvitation,
    LastOwnerProtected,
    MemberNotFound,
)

log = get_logger("homeops.households")


@dataclass(frozen=True)
class HouseholdView:
    id: str
    name: str
    default_currency: str
    role: str


@dataclass(frozen=True)
class MemberView:
    membership_id: str
    user_id: str
    email: str
    display_name: str
    role: str


@dataclass(frozen=True)
class SwitchResult:
    access_token: str
    household_id: str
    role: str


@dataclass(frozen=True)
class AcceptResult:
    household_id: str
    role: str


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _ensure_acting_household(membership: MembershipContext, household_id: str) -> None:
    """A request may only act on the household its access token is scoped to."""
    if str(household_id) != membership.household_id:
        raise HouseholdNotFound()


def _issue_access_token(*, user_id: str, household_id: uuid.UUID | str, role: str) -> str:
    cfg = current_app.config
    return encode_access_token(
        user_id=user_id,
        secret=cfg["JWT_SECRET_KEY"],
        ttl_minutes=cfg["ACCESS_TOKEN_TTL_MINUTES"],
        household_id=household_id,
        role=role,
    )


# ── User-scoped flows (auth only; no active household context required) ───────────────


def create_household(*, user_id: str, name: str, default_currency: str) -> HouseholdView:
    """Create a household; the creator becomes its OWNER. Runs in no-tenant boot mode
    because the household — and thus any tenant context — does not exist yet."""
    with session_scope(bypass_tenant=True) as session:
        owner_role = role_repo.get_by_name(session, RoleEnum.OWNER)
        if owner_role is None:  # pragma: no cover — roles are seeded by migration
            raise RuntimeError("OWNER role is not seeded")

        household = household_repo.create(
            session, name=name.strip(), default_currency=default_currency
        )
        membership_repo.add(
            session, user_id=user_id, household_id=household.id, role_id=owner_role.id
        )
        log.info("household.created", household_id=str(household.id), user_id=user_id)
        return HouseholdView(
            id=str(household.id),
            name=household.name,
            default_currency=household.default_currency,
            role=RoleEnum.OWNER.value,
        )


def list_households(*, user_id: str) -> list[HouseholdView]:
    """All active households the user belongs to (cross-tenant → no-tenant mode)."""
    with session_scope(bypass_tenant=True) as session:
        return [
            HouseholdView(
                id=str(h.id),
                name=h.name,
                default_currency=h.default_currency,
                role=m.role.name,
            )
            for h, m in household_repo.list_for_user(session, user_id)
        ]


def switch_household(*, user_id: str, household_id: str) -> SwitchResult:
    """Verify the user's membership and mint a new access token scoped to that household.

    The new token carries the ``household_id`` + role the rest of the app (and RLS) trust —
    the only way the active tenant changes. Unknown/empty membership → generic 404."""
    with session_scope(bypass_tenant=True) as session:
        membership = membership_repo.get_for_user_household(
            session, user_id=user_id, household_id=household_id
        )
        if membership is None:
            raise HouseholdNotFound()
        household = household_repo.get(session, household_id)
        if household is None or household.deleted_at is not None:
            raise HouseholdNotFound()

        role = membership.role.name
        token = _issue_access_token(user_id=user_id, household_id=household_id, role=role)
        log.info("household.switched", household_id=household_id, user_id=user_id)
        return SwitchResult(access_token=token, household_id=household_id, role=role)


def accept_invitation(*, user_id: str, raw_token: str) -> AcceptResult:
    """Consume a valid invitation and create the membership. No-tenant mode — the invitee
    is not a member yet, so the row is found by token hash (like activation)."""
    with session_scope(bypass_tenant=True) as session:
        invitation = invitation_repo.get_by_token_hash(session, _hash(raw_token))
        if invitation is None or invitation.accepted_at is not None:
            raise InvalidInvitation()
        if _as_utc(invitation.expires_at) <= datetime.now(UTC):
            raise InvalidInvitation()

        household_id = str(invitation.household_id)
        existing = membership_repo.get_for_user_household(
            session, user_id=user_id, household_id=household_id
        )
        if existing is not None:
            raise AlreadyMember()

        membership_repo.add(
            session,
            user_id=user_id,
            household_id=household_id,
            role_id=invitation.role_id,
        )
        invitation_repo.mark_accepted(session, invitation, when=datetime.now(UTC))
        role = invitation.role.name
        audit_service.record(
            session,
            household_id=str(invitation.household_id),
            actor_user_id=user_id,
            action="invitation.accepted",
            target_type="invitation",
            target_id=invitation.id,
            metadata={"role": role},
        )
        log.info(
            "invitation.accepted", household_id=str(invitation.household_id), user_id=user_id
        )
        return AcceptResult(household_id=str(invitation.household_id), role=role)


# ── Household-scoped flows (act inside the token's household; RBAC-gated) ──────────────


def invite(*, membership: MembershipContext, email: str, role: RoleEnum) -> None:
    """Create a single-use, expiring invitation and email it (plan §4.3)."""
    require_permission(membership, "member.invite")
    email = email.strip().lower()
    cfg = current_app.config
    with session_scope(household_id=membership.household_id) as session:
        role_row = role_repo.get_by_name(session, role)
        if role_row is None:  # pragma: no cover — roles are seeded
            raise RuntimeError(f"role not seeded: {role}")

        actor = membership_repo.get_for_user_household(
            session, user_id=membership.user_id, household_id=membership.household_id
        )
        household = household_repo.get(session, membership.household_id)
        if household is None:  # pragma: no cover — token implies an existing household
            raise HouseholdNotFound()

        raw_token = secrets.token_urlsafe(32)
        invitation = invitation_repo.create(
            session,
            household_id=membership.household_id,
            email=email,
            role_id=role_row.id,
            token_hash=_hash(raw_token),
            expires_at=datetime.now(UTC)
            + timedelta(hours=cfg["INVITATION_TOKEN_TTL_HOURS"]),
            created_by_membership_id=actor.id if actor else None,
        )
        audit_service.audit(
            session,
            membership,
            "invitation.created",
            "invitation",
            target_id=invitation.id,
            metadata={"email": email, "role": role.value},
        )

        invite_url = f"{cfg['PUBLIC_BASE_URL']}/invite/{raw_token}"
        get_email_sender().send(
            build_invitation_email(
                to=email,
                invite_url=invite_url,
                household_name=household.name,
                role=role.value,
                locale=cfg["MAIL_DEFAULT_LOCALE"],
            )
        )
        log.info("invitation.created", household_id=membership.household_id, role=role.value)


def list_members(*, membership: MembershipContext, household_id: str) -> list[MemberView]:
    """Members of the acting household. Any member may view the roster."""
    _ensure_acting_household(membership, household_id)
    with session_scope(household_id=membership.household_id) as session:
        return [
            MemberView(
                membership_id=str(m.id),
                user_id=str(m.user_id),
                email=m.user.email,
                display_name=m.user.display_name,
                role=m.role.name,
            )
            for m in membership_repo.list_by_household(session, membership.household_id)
        ]


def update_member_role(
    *,
    membership: MembershipContext,
    household_id: str,
    target_membership_id: str,
    role: RoleEnum,
) -> MemberView:
    require_permission(membership, "member.manage")
    _ensure_acting_household(membership, household_id)
    with session_scope(household_id=membership.household_id) as session:
        target = _load_target(session, membership.household_id, target_membership_id)
        new_role = role_repo.get_by_name(session, role)
        if new_role is None:  # pragma: no cover — roles are seeded
            raise RuntimeError(f"role not seeded: {role}")

        # Don't strip the household's last OWNER.
        if target.role.name == RoleEnum.OWNER.value and role is not RoleEnum.OWNER:
            _guard_last_owner(session, membership.household_id)

        membership_repo.update_role(session, target, role_id=new_role.id)
        session.flush()
        audit_service.audit(
            session,
            membership,
            "membership.role_updated",
            "membership",
            target_id=target.id,
            metadata={"role": role.value},
        )
        log.info(
            "membership.role_updated",
            household_id=membership.household_id,
            membership_id=target_membership_id,
            role=role.value,
        )
        return MemberView(
            membership_id=str(target.id),
            user_id=str(target.user_id),
            email=target.user.email,
            display_name=target.user.display_name,
            role=role.value,
        )


def remove_member(
    *, membership: MembershipContext, household_id: str, target_membership_id: str
) -> None:
    require_permission(membership, "member.manage")
    _ensure_acting_household(membership, household_id)
    with session_scope(household_id=membership.household_id) as session:
        target = _load_target(session, membership.household_id, target_membership_id)
        if target.role.name == RoleEnum.OWNER.value:
            _guard_last_owner(session, membership.household_id)
        removed_role = target.role.name
        membership_repo.remove(session, target)
        audit_service.audit(
            session,
            membership,
            "membership.removed",
            "membership",
            target_id=target_membership_id,
            metadata={"role": removed_role},
        )
        log.info(
            "membership.removed",
            household_id=membership.household_id,
            membership_id=target_membership_id,
        )


def delete_household(*, membership: MembershipContext, household_id: str) -> None:
    """Soft-delete the household (OWNER only, via the ``household.delete`` permission)."""
    require_permission(membership, "household.delete")
    _ensure_acting_household(membership, household_id)
    with session_scope(household_id=membership.household_id) as session:
        household = household_repo.get(session, membership.household_id)
        if household is None or household.deleted_at is not None:
            raise HouseholdNotFound()
        household_repo.soft_delete(session, household)
        audit_service.audit(
            session,
            membership,
            "household.deleted",
            "household",
            target_id=membership.household_id,
        )
        log.info("household.deleted", household_id=membership.household_id)


def _load_target(session: Session, household_id: str, target_membership_id: str) -> Membership:
    """Load a membership and confirm it belongs to the acting household (RLS + explicit)."""
    target = membership_repo.get(session, target_membership_id)
    if target is None or str(target.household_id) != str(household_id):
        raise MemberNotFound()
    return target


def _guard_last_owner(session: Session, household_id: str) -> None:
    owners = [
        m
        for m in membership_repo.list_by_household(session, household_id)
        if m.role.name == RoleEnum.OWNER.value
    ]
    if len(owners) <= 1:
        raise LastOwnerProtected()
