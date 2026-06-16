"""Request/response schemas (APIFlask/marshmallow).

One schema serves three roles (spec §5.9 DRY): input validation in the thin controller,
response serialization, and the OpenAPI source of truth.
"""

from __future__ import annotations

from apiflask import Schema
from apiflask.fields import Boolean, Date, DateTime, Email, Integer, List, Nested, String
from apiflask.validators import Length, OneOf, Range, Regexp

from app.domain.enums import ObligationStatus
from app.domain.enums import Role as RoleEnum

_OBLIGATION_STATUSES = [s.value for s in ObligationStatus]
_CURRENCY_REGEX = r"^[A-Z]{3}$"

# Roles that can be assigned to invitees / existing members (OWNER is granted only by
# creating a household, never handed out, to keep ownership unambiguous — plan §4.3).
_ASSIGNABLE_ROLE_NAMES = [r.value for r in RoleEnum if r is not RoleEnum.OWNER]


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


class RefreshOut(Schema):
    access_token = String()
    token_type = String()


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


# ── Households, memberships, invitations (plan §4.3) ─────────────────────────────────


class HouseholdIn(Schema):
    name = String(required=True, validate=Length(min=1, max=120))
    default_currency = String(required=True, validate=Length(equal=3))


class HouseholdOut(Schema):
    id = String()
    name = String()
    default_currency = String()
    role = String()  # the requesting user's role in this household


class MemberOut(Schema):
    membership_id = String()
    user_id = String()
    email = String()
    display_name = String()
    role = String()


class InviteIn(Schema):
    email = Email(required=True)
    role = String(required=True, validate=OneOf(_ASSIGNABLE_ROLE_NAMES))


class AcceptInviteIn(Schema):
    token = String(required=True, validate=Length(min=1))


class MemberRoleIn(Schema):
    role = String(required=True, validate=OneOf(_ASSIGNABLE_ROLE_NAMES))


class SwitchHouseholdIn(Schema):
    household_id = String(required=True, validate=Length(min=1))


class SwitchHouseholdOut(Schema):
    access_token = String()
    token_type = String()
    household_id = String()
    role = String()


# ── Obligations (plan §4.4) ──────────────────────────────────────────────────────────


class ObligationIn(Schema):
    """Create/update body. Money is integer minor units + ISO-4217 currency (never float).
    Used with ``partial=True`` for PATCH so any subset of fields may be supplied."""

    title = String(required=True, validate=Length(min=1, max=200))
    description = String(allow_none=True)
    category = String(allow_none=True, validate=Length(max=80))
    due_date = Date(required=True)
    # Bare rule ("FREQ=MONTHLY;BYMONTHDAY=15") or full DTSTART/RRULE block; empty → one-off.
    rrule = String(allow_none=True, validate=Length(max=500))
    assignee_membership_id = String(allow_none=True)
    estimated_amount_minor = Integer(allow_none=True)
    actual_amount_minor = Integer(allow_none=True)
    currency = String(allow_none=True, validate=Regexp(_CURRENCY_REGEX))
    lead_time_days = Integer(load_default=0, validate=Range(min=0))


class ObligationOut(Schema):
    id = String()
    title = String()
    description = String()
    category = String()
    due_date = Date()
    rrule = String()
    status = String()  # derived display status (UPCOMING/DUE/OVERDUE/DONE/SKIPPED)
    assignee_membership_id = String()
    estimated_amount_minor = Integer()
    actual_amount_minor = Integer()
    currency = String()
    lead_time_days = Integer()
    completed_at = DateTime()


class ObligationListQuery(Schema):
    status = String(validate=OneOf(_OBLIGATION_STATUSES))
    assignee = String()
    due_from = Date()
    due_to = Date()


# ── Expenses + monthly overview (plan §4.5) ──────────────────────────────────────────


class ExpenseIn(Schema):
    """Create/update body. Money is integer minor units + ISO-4217 currency (never float).
    Used with ``partial=True`` for PATCH."""

    amount_minor = Integer(required=True)
    currency = String(required=True, validate=Regexp(_CURRENCY_REGEX))
    occurred_on = Date(required=True)
    category = String(allow_none=True, validate=Length(max=80))
    service_id = String(allow_none=True)
    note = String(allow_none=True)
    is_recurring = Boolean(load_default=False)


class ExpenseOut(Schema):
    id = String()
    amount_minor = Integer()
    currency = String()
    occurred_on = Date()
    category = String()
    service_id = String()
    note = String()
    is_recurring = Boolean()


class ExpenseListQuery(Schema):
    year = Integer()
    month = Integer(validate=Range(min=1, max=12))
    category = String()


class MonthlyOverviewQuery(Schema):
    year = Integer(required=True)
    month = Integer(required=True, validate=Range(min=1, max=12))


class CategoryLineOut(Schema):
    category = String()
    amount_minor = Integer()
    count = Integer()
    delta_minor = Integer()


class CurrencyGroupOut(Schema):
    currency = String()
    categories = List(Nested(CategoryLineOut))
    fixed_total_minor = Integer()
    variable_total_minor = Integer()
    total_minor = Integer()
    delta_minor = Integer()


class MonthlyOverviewOut(Schema):
    year = Integer()
    month = Integer()
    currencies = List(Nested(CurrencyGroupOut))
