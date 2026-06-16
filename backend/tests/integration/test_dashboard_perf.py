"""The dashboard's windowed obligation scan uses the composite
``(household_id, due_date, status)`` index (plan §4.6 acceptance, §11). With seqscan
disabled the planner must reach for an index; we assert it picks the composite one.
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from sqlalchemy import text
from tests.integration._helpers import auth, create_household_and_switch, signup

from app.db.rls import session_scope

pytestmark = pytest.mark.integration


def test_obligation_window_uses_due_status_index(client, mailbox) -> None:
    token = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, scoped = create_household_and_switch(client, token, "Home")
    client.post(
        "/api/obligations",
        json={"title": "x", "due_date": date.today().isoformat()},
        headers=auth(scoped),
    )

    today = date.today()
    with session_scope(household_id=household_id) as session:
        session.execute(text("SET LOCAL enable_seqscan = off"))
        rows = (
            session.execute(
                text(
                    "EXPLAIN SELECT * FROM obligations "
                    "WHERE household_id = :h AND deleted_at IS NULL "
                    "AND due_date >= :a AND due_date <= :b"
                ),
                {
                    "h": str(household_id),
                    "a": (today - timedelta(days=90)).isoformat(),
                    "b": (today + timedelta(days=30)).isoformat(),
                },
            )
            .scalars()
            .all()
        )

    plan = "\n".join(rows)
    assert "ix_obligations_household_due_status" in plan, plan
