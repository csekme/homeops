"""Request/response schemas (APIFlask/marshmallow).

One schema serves three roles (spec §5.9 DRY): input validation in the thin controller,
response serialization, and the OpenAPI source of truth.
"""

from __future__ import annotations

from apiflask import Schema
from apiflask.fields import Email, List, Nested, String
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
    access_token = String()
    token_type = String()
    user = Nested(UserOut)


class RefreshOut(Schema):
    access_token = String()
    token_type = String()
