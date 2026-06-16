"""Expense CRUD — integer minor units on the wire, never float (plan §4.5 acceptance)."""

from __future__ import annotations

import uuid

import pytest
from tests.integration._helpers import auth, create_household_and_switch, signup

pytestmark = pytest.mark.integration


def _setup(client, mailbox, email="owner@example.com"):
    token = signup(client, mailbox, email, "Owner")
    _hid, scoped = create_household_and_switch(client, token, "Home")
    return scoped


def test_create_list_get_roundtrip(client, mailbox) -> None:
    scoped = _setup(client, mailbox)
    created = client.post(
        "/api/expenses",
        json={
            "amount_minor": 123456,
            "currency": "HUF",
            "occurred_on": "2026-06-10",
            "category": "groceries",
            "note": "weekly shop",
        },
        headers=auth(scoped),
    )
    assert created.status_code == 201, created.json
    assert created.json["amount_minor"] == 123456
    assert isinstance(created.json["amount_minor"], int)
    expense_id = created.json["id"]

    fetched = client.get(f"/api/expenses/{expense_id}", headers=auth(scoped))
    assert fetched.status_code == 200
    assert fetched.json["category"] == "groceries"
    assert fetched.json["is_recurring"] is False

    listed = client.get("/api/expenses", headers=auth(scoped))
    assert listed.status_code == 200
    assert len(listed.json) == 1


def test_update_and_soft_delete(client, mailbox) -> None:
    scoped = _setup(client, mailbox)
    created = client.post(
        "/api/expenses",
        json={"amount_minor": 1000, "currency": "EUR", "occurred_on": "2026-06-01"},
        headers=auth(scoped),
    )
    expense_id = created.json["id"]

    updated = client.patch(
        f"/api/expenses/{expense_id}",
        json={"amount_minor": 2000, "category": "transport"},
        headers=auth(scoped),
    )
    assert updated.status_code == 200
    assert updated.json["amount_minor"] == 2000
    assert updated.json["category"] == "transport"

    deleted = client.delete(f"/api/expenses/{expense_id}", headers=auth(scoped))
    assert deleted.status_code == 204
    assert client.get(f"/api/expenses/{expense_id}", headers=auth(scoped)).status_code == 404
    assert client.get("/api/expenses", headers=auth(scoped)).json == []


def test_list_filters_by_month_and_category(client, mailbox) -> None:
    scoped = _setup(client, mailbox)
    rows = [
        (100, "2026-06-05", "food"),
        (200, "2026-06-20", "fuel"),
        (300, "2026-07-02", "food"),
    ]
    for amount, when, cat in rows:
        client.post(
            "/api/expenses",
            json={"amount_minor": amount, "currency": "HUF", "occurred_on": when, "category": cat},
            headers=auth(scoped),
        )

    june = client.get("/api/expenses?year=2026&month=6", headers=auth(scoped))
    assert {e["amount_minor"] for e in june.json} == {100, 200}

    june_food = client.get(
        "/api/expenses?year=2026&month=6&category=food", headers=auth(scoped)
    )
    assert [e["amount_minor"] for e in june_food.json] == [100]


def test_bad_currency_is_rejected_by_schema(client, mailbox) -> None:
    scoped = _setup(client, mailbox)
    bad = client.post(
        "/api/expenses",
        json={"amount_minor": 100, "currency": "huf", "occurred_on": "2026-06-01"},
        headers=auth(scoped),
    )
    assert bad.status_code == 422


def test_missing_expense_is_404(client, mailbox) -> None:
    scoped = _setup(client, mailbox)
    r = client.get(f"/api/expenses/{uuid.uuid4()}", headers=auth(scoped))
    assert r.status_code == 404
