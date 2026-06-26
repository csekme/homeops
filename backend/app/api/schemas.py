"""Request/response schemas (APIFlask/marshmallow).

One schema serves three roles (spec §5.9 DRY): input validation in the thin controller,
response serialization, and the OpenAPI source of truth.
"""

from __future__ import annotations

from apiflask import Schema
from apiflask.fields import Boolean, Email, Integer, List, Nested, String
from apiflask.validators import Length, OneOf, Regexp

from app.domain.enums import Role as RoleEnum

_ROLE_NAMES = [r.value for r in RoleEnum]


class MessageOut(Schema):
    message = String()


class RegisterIn(Schema):
    email = Email(required=True)
    password = String(required=True, validate=Length(min=8, max=128))
    display_name = String(required=True, validate=Length(min=1, max=120))
    locale = String(load_default="hu", validate=Length(equal=2))


class ActivateIn(Schema):
    token = String(required=True, validate=Length(min=1))


class LoginIn(Schema):
    email = Email(required=True)
    password = String(required=True, validate=Length(min=1, max=128))


class MembershipOut(Schema):
    household_id = String()
    household_name = String()
    role = String()


class UserOut(Schema):
    id = String()
    email = String()
    display_name = String()
    status = String()
    # The household the current access token is scoped to (from the JWT claim); null until
    # the user creates/switches into one. Lets clients show the active tenant on boot.
    active_household_id = String(allow_none=True)
    memberships = List(Nested(MembershipOut))


class LoginOut(Schema):
    # When 2FA is required only `mfa_required` + `challenge_token` are returned (HTTP 200);
    # otherwise the full session payload. The controller emits one shape or the other.
    access_token = String()
    token_type = String()
    user = Nested(UserOut)
    mfa_required = Boolean()
    challenge_token = String()
    # Mobile (bearer transport) only: the refresh token travels in the body instead of an
    # HttpOnly cookie, for storage in expo-secure-store. Omitted on the web (cookie) path.
    refresh_token = String()


class RefreshOut(Schema):
    access_token = String()
    token_type = String()
    # Mobile (bearer transport) only — see LoginOut.refresh_token. Omitted on the web path.
    refresh_token = String()


# ── Two-factor authentication (TOTP) ────────────────────────────────────────────────


class TotpSetupOut(Schema):
    provisioning_uri = String()
    secret = String()


class TotpConfirmIn(Schema):
    code = String(required=True, validate=Length(min=6, max=12))


class TotpVerifyIn(Schema):
    challenge_token = String(required=True, validate=Length(min=1))
    # TOTP (6 digits) or a formatted backup code (e.g. "a3kf-9p2m-7xqd").
    code = String(required=True, validate=Length(min=6, max=32))


class TotpDisableIn(Schema):
    password = String(required=True, validate=Length(min=1, max=128))


class RecoveryRegenerateIn(Schema):
    password = String(required=True, validate=Length(min=1, max=128))


class TotpStatusOut(Schema):
    enabled = Boolean()
    recovery_codes_remaining = Integer()


class RecoveryCodesOut(Schema):
    codes = List(String())


# ── Household management ──────────────────────────────────────────────────────────────


class HouseholdCreateIn(Schema):
    name = String(required=True, validate=Length(min=1, max=120))
    # ISO-4217 alphabetic code; the DB CHECK enforces the same pattern.
    default_currency = String(
        load_default="HUF", validate=Regexp(r"^[A-Z]{3}$", error="Invalid ISO-4217 currency.")
    )


class HouseholdRenameIn(Schema):
    name = String(required=True, validate=Length(min=1, max=120))


class HouseholdOut(Schema):
    id = String()
    name = String()
    default_currency = String()
    role = String()  # the caller's role in this household


class HouseholdListOut(Schema):
    households = List(Nested(HouseholdOut))


class SwitchOut(Schema):
    """Lighter session payload for create/switch/accept — a new access token only (the
    refresh family is untouched, so no cookie/body refresh token)."""

    access_token = String()
    token_type = String()
    household = Nested(HouseholdOut)


class MemberOut(Schema):
    membership_id = String()
    user_id = String()
    email = String()
    display_name = String()
    role = String()


class MemberListOut(Schema):
    members = List(Nested(MemberOut))


class ChangeRoleIn(Schema):
    role = String(required=True, validate=OneOf(_ROLE_NAMES))


class InviteCreateIn(Schema):
    email = Email(required=True)
    role = String(required=True, validate=OneOf(_ROLE_NAMES))


class InvitationOut(Schema):
    id = String()
    email = String()
    role = String()
    expires_at = String()
    created_at = String()


class InvitationListOut(Schema):
    invitations = List(Nested(InvitationOut))


class InvitationPreviewOut(Schema):
    household_name = String()
    role = String()
    email = String()


class InviteAcceptIn(Schema):
    token = String(required=True, validate=Length(min=1))
