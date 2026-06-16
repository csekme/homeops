"""The month-window expense scan uses the ``(household_id, occurred_on)`` index
(plan §4.5 acceptance, §11). With seqscan disabled the planner must reach for an index;
we assert it picks the composite one that covers both predicates.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from tests.integration._helpers import auth, create_household_and_switch, signup

from app.db.rls import session_scope

pytestmark = pytest.mark.integration


def test_list_uses_household_occurred_index(client, mailbox) -> None:
    token = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, scoped = create_household_and_switch(client, token, "Home")
    client.post(
        "/api/expenses",
        json={"amount_minor": 100, "currency": "HUF", "occurred_on": "2026-06-10"},
        headers=auth(scoped),
    )

    with session_scope(household_id=household_id) as session:
        # Force the planner off seqscan so an index is chosen if any is usable.
        session.execute(text("SET LOCAL enable_seqscan = off"))
        rows = (
            session.execute(
                text(
                    "EXPLAIN SELECT * FROM expenses "
                    "WHERE household_id = :h AND occurred_on >= :a AND occurred_on < :b "
                    "AND deleted_at IS NULL"
                ),
                {"h": str(household_id), "a": "2026-06-01", "b": "2026-07-01"},
            )
            .scalars()
            .all()
        )

    plan = "\n".join(rows)
    assert "ix_expenses_household_occurred" in plan, plan
