"""The audit_log is append-only (plan §4.8 acceptance, §9 security matrix).

Two independent guards: the app role lacks UPDATE/DELETE privilege, and a trigger refuses
the mutation even for the privileged owner.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from tests.integration._helpers import auth, create_household_and_switch, signup

from app.db.rls import session_scope

pytestmark = pytest.mark.integration


def _seed_audit_row(client, mailbox) -> str:
    """Perform an audited action; return the household id that now has an audit row."""
    owner = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, scoped = create_household_and_switch(client, owner, "Home")
    created = client.post(
        "/api/obligations",
        json={"title": "Bye", "due_date": "2026-06-20"},
        headers=auth(scoped),
    )
    client.delete(f"/api/obligations/{created.json['id']}", headers=auth(scoped))
    return household_id


def test_app_role_cannot_update_or_delete(client, mailbox) -> None:
    household_id = _seed_audit_row(client, mailbox)

    with pytest.raises(Exception), session_scope(household_id=household_id) as session:  # noqa: B017
        session.execute(text("UPDATE audit_log SET action = 'tampered'"))

    with pytest.raises(Exception), session_scope(household_id=household_id) as session:  # noqa: B017
        session.execute(text("DELETE FROM audit_log"))


def test_trigger_blocks_even_privileged_owner(client, mailbox, _privileged_engine) -> None:
    _seed_audit_row(client, mailbox)

    # The privileged owner bypasses the REVOKE — the trigger is the backstop.
    with pytest.raises(Exception) as excinfo, _privileged_engine.begin() as conn:
        conn.execute(text("UPDATE audit_log SET action = 'tampered'"))
    assert "append-only" in str(excinfo.value)
