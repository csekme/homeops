"""Request/response schemas (APIFlask/marshmallow).

One schema serves three roles (spec §5.9 DRY): input validation in the thin controller,
response serialization, and the OpenAPI source of truth.
"""

from __future__ import annotations

from apiflask import Schema
from apiflask.fields import Boolean, Email, Integer, List, Nested, String
from apiflask.validators import Length


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
    memberships = List(Nested(MembershipOut))


class LoginOut(Schema):
    # When 2FA is required only `mfa_required` + `challenge_token` are returned (HTTP 200);
    # otherwise the full session payload. The controller emits one shape or the other.
    access_token = String()
    token_type = String()
    user = Nested(UserOut)
    mfa_required = Boolean()
    challenge_token = String()
    # Mobile clients (X-Client-Type: mobile) get the refresh token in the body instead of a
    # cookie; web clients never see this field (it stays in the HttpOnly cookie).
    refresh_token = String()


class RefreshOut(Schema):
    access_token = String()
    token_type = String()
    # Mobile only: the rotated refresh token (body-refresh strategy). Absent for web.
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
