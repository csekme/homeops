"""Role-sensitive dashboard payload (plan §4.6 acceptance).

OWNER/ADMIN/MEMBER get the financial blocks; CHILD/VIEWER do not — and the fields are
**absent from the JSON**, not merely hidden. CHILD additionally sees only their own
obligations (server-side scope, inherited from ``obligation_service``).
"""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from tests.integration._helpers import (
    auth,
    create_household_and_switch,
    invite_and_join,
    signup,
)

pytestmark = pytest.mark.integration

_FINANCIAL_KEYS = {"monthly_overview", "due_payments"}


def _add_obligation(client, scoped, *, title, due, amount=None, assignee=None):
    body = {"title": title, "due_date": due.isoformat()}
    if amount is not None:
        body["estimated_amount_minor"] = amount
        body["currency"] = "HUF"
    if assignee is not None:
        body["assignee_membership_id"] = assignee
    r = client.post("/api/obligations", json=body, headers=auth(scoped))
    assert r.status_code == 201, r.json


def _setup(client, mailbox):
    today = date.today()
    owner = signup(client, mailbox, "owner@example.com", "Owner")
    household_id, owner_scoped = create_household_and_switch(client, owner, "Home")

    child_scoped, child_mid = invite_and_join(
        client, mailbox, owner_scoped=owner_scoped, household_id=household_id,
        email="kid@example.com", role="CHILD", name="Kid",
    )
    member_scoped, _ = invite_and_join(
        client, mailbox, owner_scoped=owner_scoped, household_id=household_id,
        email="mem@example.com", role="MEMBER", name="Mem",
    )
    viewer_scoped, _ = invite_and_join(
        client, mailbox, owner_scoped=owner_scoped, household_id=household_id,
        email="vw@example.com", role="VIEWER", name="Viewer",
    )

    _add_obligation(client, owner_scoped, title="Pay today", due=today, amount=50000)
    _add_obligation(
        client, owner_scoped, title="Overdue bill", due=today - timedelta(days=3), amount=30000
    )
    _add_obligation(client, owner_scoped, title="Soon, no money", due=today + timedelta(days=5))
    _add_obligation(
        client, owner_scoped, title="Kid chore", due=today, amount=10000, assignee=child_mid
    )
    client.post(
        "/api/expenses",
        json={"amount_minor": 1200, "currency": "HUF", "occurred_on": today.isoformat()},
        headers=auth(owner_scoped),
    )
    return {
        "owner": owner_scoped,
        "member": member_scoped,
        "viewer": viewer_scoped,
        "child": child_scoped,
    }


def test_financial_roles_see_money_blocks(client, mailbox) -> None:
    tokens = _setup(client, mailbox)
    for role in ("owner", "member"):
        dash = client.get("/api/dashboard", headers=auth(tokens[role]))
        assert dash.status_code == 200, dash.json
        body = dash.json
        assert set(body) >= _FINANCIAL_KEYS, f"{role} missing financial keys"
        assert body["monthly_overview"]["currencies"], role
        # All money-bearing obligations that are due/overdue (the kid's chore included —
        # OWNER/MEMBER see the whole household, only CHILD is scoped to their own).
        assert {p["title"] for p in body["due_payments"]} == {
            "Pay today",
            "Overdue bill",
            "Kid chore",
        }
        # All-role widgets present too.
        assert {o["title"] for o in body["overdue_obligations"]} == {"Overdue bill"}


def test_child_and_viewer_have_no_financial_blocks(client, mailbox) -> None:
    tokens = _setup(client, mailbox)
    for role in ("child", "viewer"):
        dash = client.get("/api/dashboard", headers=auth(tokens[role]))
        assert dash.status_code == 200, dash.json
        body = dash.json
        assert not (_FINANCIAL_KEYS & set(body)), f"{role} leaked financial keys: {set(body)}"
        # Non-financial widgets are still present.
        assert "upcoming_obligations" in body
        assert "alerts" in body


def test_child_sees_only_their_own_obligations(client, mailbox) -> None:
    tokens = _setup(client, mailbox)
    dash = client.get("/api/dashboard", headers=auth(tokens["child"]))
    titles = {o["title"] for o in dash.json["upcoming_obligations"]}
    assert titles == {"Kid chore"}


def test_viewer_sees_all_obligations(client, mailbox) -> None:
    tokens = _setup(client, mailbox)
    dash = client.get("/api/dashboard", headers=auth(tokens["viewer"]))
    upcoming = {o["title"] for o in dash.json["upcoming_obligations"]}
    assert upcoming == {"Pay today", "Soon, no money", "Kid chore"}
    assert {o["title"] for o in dash.json["overdue_obligations"]} == {"Overdue bill"}
