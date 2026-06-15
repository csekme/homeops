"""RLS isolation proof (plan §3.6 acceptance, §13).

With ``app.current_household = A`` the non-privileged app role sees zero of B's rows —
**even with the application-level WHERE removed** — because the DB policy enforces it.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import text

from app.db.rls import session_scope

pytestmark = pytest.mark.integration


def _seed_two_households(privileged_engine) -> tuple[uuid.UUID, uuid.UUID]:
    a, b, user = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    with privileged_engine.begin() as conn:
        role_id = conn.execute(text("SELECT id FROM roles WHERE name = 'OWNER'")).scalar_one()
        conn.execute(
            text(
                "INSERT INTO households (id, name, default_currency) "
                "VALUES (:a, 'A', 'HUF'), (:b, 'B', 'EUR')"
            ),
            {"a": str(a), "b": str(b)},
        )
        conn.execute(
            text(
                "INSERT INTO users (id, email, password_hash, display_name, status) "
                "VALUES (:u, 'rls@example.com', 'x', 'U', 'ACTIVE')"
            ),
            {"u": str(user)},
        )
        conn.execute(
            text(
                "INSERT INTO memberships (id, user_id, household_id, role_id) "
                "VALUES (:m1, :u, :a, :r), (:m2, :u, :b, :r)"
            ),
            {
                "m1": str(uuid.uuid4()),
                "m2": str(uuid.uuid4()),
                "u": str(user),
                "a": str(a),
                "b": str(b),
                "r": str(role_id),
            },
        )
    return a, b


def test_rls_hides_other_tenant_without_where(app, _privileged_engine) -> None:
    a, _b = _seed_two_households(_privileged_engine)

    # NB: no `WHERE household_id` here — the DB policy is the only thing filtering.
    with session_scope(household_id=a) as session:
        memberships = session.execute(text("SELECT household_id FROM memberships")).scalars().all()
        households = session.execute(text("SELECT id FROM households")).scalars().all()

    assert {str(x) for x in memberships} == {str(a)}
    assert {str(x) for x in households} == {str(a)}


def test_no_tenant_context_sees_nothing(app, _privileged_engine) -> None:
    _seed_two_households(_privileged_engine)
    with session_scope() as session:  # neither tenant set nor bypass
        count = session.execute(text("SELECT count(*) FROM households")).scalar_one()
    assert count == 0


def test_bypass_mode_sees_all_for_auth(app, _privileged_engine) -> None:
    a, b = _seed_two_households(_privileged_engine)
    with session_scope(bypass_tenant=True) as session:
        households = session.execute(text("SELECT id FROM households")).scalars().all()
    assert {str(x) for x in households} == {str(a), str(b)}
