"""Request/response schemas (APIFlask/marshmallow).

One schema serves three roles (spec §5.9 DRY): input validation in the thin controller,
response serialization, and the OpenAPI source of truth.
"""

from __future__ import annotations

from apiflask import Schema
from apiflask.fields import Boolean, Email, File, Integer, List, Nested, String
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


class ForgotPasswordIn(Schema):
    email = Email(required=True)
    locale = String(load_default="hu", validate=Length(equal=2))


class ResetPasswordIn(Schema):
    token = String(required=True, validate=Length(min=1))
    password = String(required=True, validate=Length(min=8, max=128))


class LoginIn(Schema):
    email = Email(required=True)
    password = String(required=True, validate=Length(min=1, max=128))
    # "Remember me on this device": persistent session (long refresh TTL + persistent cookie).
    # The web client also sets ``grant_trust`` from the same checkbox.
    remember_me = Boolean(load_default=False)
    # Opt into skipping the 2FA step on this device for the trust window. Honoured only when
    # 2FA is enabled; ignored otherwise. Separate field so the two concerns can diverge later.
    grant_trust = Boolean(load_default=False)


class MembershipOut(Schema):
    household_id = String()
    household_name = String()
    role = String()


class UserOut(Schema):
    id = String()
    email = String()
    display_name = String()
    status = String()
    # Public, cache-busted path to the profile picture (e.g. "/api/users/{id}/avatar?v=…");
    # null when the user has no avatar. Relative — clients resolve against their API origin.
    avatar_url = String(allow_none=True)
    # The household the current access token is scoped to (from the JWT claim); null until
    # the user creates/switches into one. Lets clients show the active tenant on boot.
    active_household_id = String(allow_none=True)
    memberships = List(Nested(MembershipOut))


class AvatarUploadIn(Schema):
    # Multipart file field (location='files'); the client uploads a cropped square image and
    # the service re-encodes it to a canonical WEBP (feature plan §Avatar).
    file = File(required=True)


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
    # Mobile (bearer transport) only: device-identity + 2FA-bypass secrets to persist in
    # expo-secure-store. Web receives these as HttpOnly cookies instead. ``device_id`` is set
    # only when a new device is registered; ``device_trust`` only when trust is granted.
    device_id = String()
    device_trust = String()


class RefreshOut(Schema):
    access_token = String()
    token_type = String()
    # Mobile (bearer transport) only — see LoginOut.refresh_token. Omitted on the web path.
    refresh_token = String()
    # Mobile (bearer transport) only: the rotated 2FA-bypass secret, set when a trusted device
    # rotated its trust on this refresh. The client must replace its stored value.
    device_trust = String()


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
    # Accept by the emailed token (invite-link page) OR by invitation id (dashboard "my
    # invitations", where the raw token isn't available). Exactly one is expected; the
    # controller rejects a request that supplies neither.
    token = String(required=False, validate=Length(min=1))
    invitation_id = String(required=False, validate=Length(min=1))


class InviteDeclineIn(Schema):
    # Decline by the emailed token (invite-link page) OR by invitation id (dashboard). Exactly
    # one is expected; the controller rejects a request that supplies neither.
    token = String(required=False, validate=Length(min=1))
    invitation_id = String(required=False, validate=Length(min=1))


class MyInvitationOut(Schema):
    id = String()
    household_name = String()
    role = String()
    email = String()
    expires_at = String()
    created_at = String()


class MyInvitationListOut(Schema):
    invitations = List(Nested(MyInvitationOut))


# ── Device / session management (feature plan §Device registration) ──────────────────


class DeviceOut(Schema):
    id = String()
    name = String()
    platform = String()
    last_ip = String(allow_none=True)
    last_seen_at = String()
    created_at = String()
    # Whether this device may currently skip the 2FA step (a live trust window).
    trusted = Boolean()
    # Whether this is the device making the request (so the UI can label it "this device").
    current = Boolean()


class DeviceListOut(Schema):
    devices = List(Nested(DeviceOut))


class DeviceRenameIn(Schema):
    name = String(required=True, validate=Length(min=1, max=80))
