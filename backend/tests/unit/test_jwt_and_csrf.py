import uuid

import pytest

from app.security.csrf import verify_csrf
from app.security.jwt_tokens import (
    TokenError,
    decode_access_token,
    encode_access_token,
)

_SECRET = "unit-test-secret"


def test_access_token_round_trip_with_claims() -> None:
    uid = uuid.uuid4()
    hid = uuid.uuid4()
    token = encode_access_token(
        user_id=uid, secret=_SECRET, ttl_minutes=15, household_id=hid, role="OWNER"
    )
    claims = decode_access_token(token, secret=_SECRET)
    assert claims.sub == str(uid)
    assert claims.household_id == str(hid)
    assert claims.role == "OWNER"
    assert claims.jti


def test_expired_token_raises() -> None:
    token = encode_access_token(user_id=uuid.uuid4(), secret=_SECRET, ttl_minutes=-1)
    with pytest.raises(TokenError):
        decode_access_token(token, secret=_SECRET)


def test_wrong_secret_raises() -> None:
    token = encode_access_token(user_id=uuid.uuid4(), secret=_SECRET, ttl_minutes=15)
    with pytest.raises(TokenError):
        decode_access_token(token, secret="other-secret")


def test_csrf_double_submit() -> None:
    assert verify_csrf("abc", "abc") is True
    assert verify_csrf("abc", "xyz") is False
    assert verify_csrf(None, "abc") is False
    assert verify_csrf("abc", None) is False
