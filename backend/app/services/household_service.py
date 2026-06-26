"""Household management service (feature plan §Backend).

Two session modes (plan §3.6):

- **No-tenant** (``bypass_tenant=True``) for operations that span households or precede
  membership: ``create`` (no active household yet), ``switch`` ("does this user belong to
  X?"), ``list_for_user``. The membership check in application code is the guard here.
- **Tenant** (``session_scope(household_id=...)``) for in-household operations
  (rename/archive/members), where RLS is a real second layer. The controller enforces that
  the path ``{id}`` equals the JWT's active household, so ``app.current_household`` stays
  sourced only from the token.

Authorization is always re-read from the DB membership (``authorization`` module), never
trusted from the JWT ``role`` claim.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from flask import current_app

from app.db.rls import session_scope
from app.domain.enums import Role as RoleEnum
from app.logging_config import get_logger
from app.repositories import households as households_repo
from app.repositories import memberships as membership_repo
from app.repositories import roles as roles_repo
from app.security import refresh_tokens
from app.security.jwt_tokens import encode_access_token
from app.services import authorization
from app.services.exceptions import (
    HouseholdNotFound,
    LastOwnerError,
    NotAMember,
)

log = get_logger("homeops.household")


@dataclass(frozen=True)
class HouseholdView:
    id: str
    name: str
    default_currency: str
    role: str  # the caller's role in this household


@dataclass(frozen=True)
class MemberView:
    membership_id: str
    user_id: str
    email: str
    display_name: str
    role: str


@dataclass(frozen=True)
class SwitchResult:
    """A freshly minted access token for a (new) active household.

    Only the access token changes — the refresh family is untouched (its DB row is
    re-pointed at the new household so the next refresh follows). Web and mobile both just
    swap their in-memory access token; no Set-Cookie.
    """

    access_token: str
    household: HouseholdView


def mint_access_token(
    *, user_id: uuid.UUID | str, household_id: uuid.UUID | str, role: str
) -> str:
    """Mint a short-lived access token carrying the active household + role claims."""
    cfg = current_app.config
    return encode_access_token(
        user_id=user_id,
        secret=cfg["JWT_SECRET_KEY"],
        ttl_minutes=cfg["ACCESS_TOKEN_TTL_MINUTES"],
        household_id=household_id,
        role=role,
    )


def create(*, user_id: uuid.UUID | str, name: str, default_currency: str) -> SwitchResult:
    """Create a household, make the caller its OWNER, and auto-switch into it.

    Runs in no-tenant mode: there is no active household yet, and the ``households`` /
    ``memberships`` ``WITH CHECK`` policies would reject the inserts without bypass.
    """
    with session_scope(bypass_tenant=True) as session:
        owner_role = roles_repo.get_by_name(session, RoleEnum.OWNER.value)
        if owner_role is None:  # pragma: no cover — roles are seeded by migration
            raise RuntimeError("OWNER role missing from catalogue")

        household = households_repo.create(
            session, name=name.strip(), default_currency=default_currency
        )
        membership_repo.add(
            session, user_id=user_id, household_id=household.id, role_id=owner_role.id
        )
        refresh_tokens.set_active_household(
            session, user_id=user_id, household_id=household.id
        )
        access = mint_access_token(
            user_id=user_id, household_id=household.id, role=owner_role.name
        )
        log.info("household.created", user_id=str(user_id), household_id=str(household.id))
        return SwitchResult(
            access_token=access,
            household=HouseholdView(
                id=str(household.id),
                name=household.name,
                default_currency=household.default_currency,
                role=owner_role.name,
            ),
        )


def switch(*, user_id: uuid.UUID | str, household_id: uuid.UUID | str) -> SwitchResult:
    """Re-mint the access token for another household the caller belongs to.

    No-tenant mode (cross-household membership lookup). A missing/soft-deleted household or
    a missing membership both raise (→ 404) so non-members can't probe household existence.
    """
    with session_scope(bypass_tenant=True) as session:
        household = households_repo.get_by_id(session, household_id)
        if household is None:
            raise HouseholdNotFound("household not found")
        membership = membership_repo.get(session, user_id=user_id, household_id=household_id)
        if membership is None:
            raise NotAMember("not a member of this household")

        refresh_tokens.set_active_household(session, user_id=user_id, household_id=household.id)
        access = mint_access_token(
            user_id=user_id, household_id=household.id, role=membership.role.name
        )
        log.info("household.switched", user_id=str(user_id), household_id=str(household.id))
        return SwitchResult(
            access_token=access,
            household=HouseholdView(
                id=str(household.id),
                name=household.name,
                default_currency=household.default_currency,
                role=membership.role.name,
            ),
        )


def list_for_user(*, user_id: uuid.UUID | str) -> list[HouseholdView]:
    """All households the caller belongs to (excluding soft-deleted), with their role."""
    with session_scope(bypass_tenant=True) as session:
        return [
            HouseholdView(
                id=str(m.household_id),
                name=m.household.name,
                default_currency=m.household.default_currency,
                role=m.role.name,
            )
            for m in households_repo.list_for_user(session, user_id)
        ]


def rename(
    *, user_id: uuid.UUID | str, household_id: uuid.UUID | str, name: str
) -> HouseholdView:
    with session_scope(household_id=household_id) as session:
        membership = authorization.require_permission(
            session, user_id=user_id, household_id=household_id, permission="member.manage"
        )
        household = households_repo.get_by_id(session, household_id)
        if household is None:
            raise HouseholdNotFound("household not found")
        households_repo.rename(session, household, name=name.strip())
        return HouseholdView(
            id=str(household.id),
            name=household.name,
            default_currency=household.default_currency,
            role=membership.role.name,
        )


def archive(*, user_id: uuid.UUID | str, household_id: uuid.UUID | str) -> None:
    """Soft-delete a household (OWNER-only via the ``household.delete`` permission)."""
    with session_scope(household_id=household_id) as session:
        authorization.require_permission(
            session, user_id=user_id, household_id=household_id, permission="household.delete"
        )
        household = households_repo.get_by_id(session, household_id)
        if household is None:
            raise HouseholdNotFound("household not found")
        households_repo.soft_delete(session, household)
        log.info("household.archived", user_id=str(user_id), household_id=str(household_id))


def list_members(
    *, user_id: uuid.UUID | str, household_id: uuid.UUID | str
) -> list[MemberView]:
    with session_scope(household_id=household_id) as session:
        authorization.load_membership(session, user_id=user_id, household_id=household_id)
        return [
            MemberView(
                membership_id=str(m.id),
                user_id=str(m.user_id),
                email=m.user.email,
                display_name=m.user.display_name,
                role=m.role.name,
            )
            for m in membership_repo.list_for_household(session, household_id)
        ]


def change_role(
    *,
    actor_id: uuid.UUID | str,
    household_id: uuid.UUID | str,
    target_user_id: uuid.UUID | str,
    new_role: str,
) -> MemberView:
    with session_scope(household_id=household_id) as session:
        authorization.require_permission(
            session, user_id=actor_id, household_id=household_id, permission="member.manage"
        )
        target = membership_repo.get(
            session, user_id=target_user_id, household_id=household_id
        )
        if target is None:
            raise NotAMember("target is not a member of this household")

        role = roles_repo.get_by_name(session, new_role)
        if role is None:  # pragma: no cover — role is schema-validated
            raise HouseholdNotFound("unknown role")

        # Last-owner guard: demoting the only OWNER would orphan the household.
        if (
            target.role.name == RoleEnum.OWNER.value
            and new_role != RoleEnum.OWNER.value
            and membership_repo.count_owners(session, household_id) <= 1
        ):
            raise LastOwnerError("cannot demote the last owner")

        membership_repo.change_role(session, target, role_id=role.id)
        return MemberView(
            membership_id=str(target.id),
            user_id=str(target.user_id),
            email=target.user.email,
            display_name=target.user.display_name,
            role=role.name,
        )


def remove_member(
    *,
    actor_id: uuid.UUID | str,
    household_id: uuid.UUID | str,
    target_user_id: uuid.UUID | str,
) -> None:
    with session_scope(household_id=household_id) as session:
        authorization.require_permission(
            session, user_id=actor_id, household_id=household_id, permission="member.manage"
        )
        target = membership_repo.get(
            session, user_id=target_user_id, household_id=household_id
        )
        if target is None:
            raise NotAMember("target is not a member of this household")
        if (
            target.role.name == RoleEnum.OWNER.value
            and membership_repo.count_owners(session, household_id) <= 1
        ):
            raise LastOwnerError("cannot remove the last owner")
        membership_repo.remove(session, target)
        log.info(
            "household.member_removed",
            actor_id=str(actor_id),
            household_id=str(household_id),
            target_user_id=str(target_user_id),
        )


def leave(*, user_id: uuid.UUID | str, household_id: uuid.UUID | str) -> None:
    """The caller leaves a household. Refused if they are the last OWNER."""
    with session_scope(household_id=household_id) as session:
        membership = authorization.load_membership(
            session, user_id=user_id, household_id=household_id
        )
        if (
            membership.role.name == RoleEnum.OWNER.value
            and membership_repo.count_owners(session, household_id) <= 1
        ):
            raise LastOwnerError("the last owner cannot leave; transfer ownership first")
        membership_repo.remove(session, membership)
        log.info("household.left", user_id=str(user_id), household_id=str(household_id))
