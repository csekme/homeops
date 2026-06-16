"""Monthly overview: per-(currency, category) totals, MoM delta, no cross-currency sum
(plan §4.5 acceptance, decision §10.1 — no FX)."""

from __future__ import annotations

import pytest
from tests.integration._helpers import auth, create_household_and_switch, signup

pytestmark = pytest.mark.integration


def _setup(client, mailbox):
    token = signup(client, mailbox, "owner@example.com", "Owner")
    _hid, scoped = create_household_and_switch(client, token, "Home")
    return scoped


def _add(client, scoped, *, amount, currency, when, category, recurring=False):
    r = client.post(
        "/api/expenses",
        json={
            "amount_minor": amount,
            "currency": currency,
            "occurred_on": when,
            "category": category,
            "is_recurring": recurring,
        },
        headers=auth(scoped),
    )
    assert r.status_code == 201, r.json


def _by_currency(payload: dict) -> dict:
    return {g["currency"]: g for g in payload["currencies"]}


def test_overview_groups_per_currency_category_with_delta(client, mailbox) -> None:
    scoped = _setup(client, mailbox)

    # Previous month (May 2026).
    _add(client, scoped, amount=800, currency="HUF", when="2026-05-10", category="food")
    _add(
        client, scoped, amount=30000, currency="HUF", when="2026-05-01",
        category="rent", recurring=True,
    )
    _add(client, scoped, amount=5000, currency="EUR", when="2026-05-15", category="travel")

    # Current month (June 2026).
    _add(client, scoped, amount=1000, currency="HUF", when="2026-06-05", category="food")
    _add(client, scoped, amount=500, currency="HUF", when="2026-06-20", category="food")
    _add(
        client, scoped, amount=30000, currency="HUF", when="2026-06-01",
        category="rent", recurring=True,
    )
    _add(client, scoped, amount=2000, currency="EUR", when="2026-06-12", category="travel")

    overview = client.get("/api/expenses/overview?year=2026&month=6", headers=auth(scoped))
    assert overview.status_code == 200, overview.json
    groups = _by_currency(overview.json)

    # Two distinct currencies, never combined into a single total.
    assert set(groups) == {"HUF", "EUR"}

    huf = groups["HUF"]
    huf_cats = {c["category"]: c for c in huf["categories"]}
    assert huf_cats["food"]["amount_minor"] == 1500
    assert huf_cats["food"]["count"] == 2
    assert huf_cats["food"]["delta_minor"] == 700  # 1500 vs 800 last month
    assert huf_cats["rent"]["delta_minor"] == 0  # 30000 both months
    assert huf["fixed_total_minor"] == 30000  # recurring rent
    assert huf["variable_total_minor"] == 1500  # food
    assert huf["total_minor"] == 31500
    assert huf["delta_minor"] == 700  # 31500 vs 30800

    eur = groups["EUR"]
    eur_cats = {c["category"]: c for c in eur["categories"]}
    assert eur_cats["travel"]["amount_minor"] == 2000
    assert eur_cats["travel"]["delta_minor"] == -3000  # 2000 vs 5000
    assert eur["total_minor"] == 2000
    assert eur["delta_minor"] == -3000

    # No cross-currency aggregate anywhere in the payload.
    assert "total_minor" not in overview.json


def test_overview_empty_month_has_no_currencies(client, mailbox) -> None:
    scoped = _setup(client, mailbox)
    overview = client.get("/api/expenses/overview?year=2026&month=6", headers=auth(scoped))
    assert overview.status_code == 200
    assert overview.json["currencies"] == []
