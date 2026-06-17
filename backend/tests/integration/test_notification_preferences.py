"""Notification preferences round-trip via the API (plan §4.7/§4.13)."""

from __future__ import annotations

import pytest
from tests.integration._helpers import auth, create_household_and_switch, signup

pytestmark = pytest.mark.integration


def _setup(client, mailbox):
    token = signup(client, mailbox, "owner@example.com", "Owner")
    _hid, scoped = create_household_and_switch(client, token, "Home")
    return scoped


def test_put_then_get_roundtrip(client, mailbox) -> None:
    scoped = _setup(client, mailbox)

    put = client.put(
        "/api/notification-preferences",
        json={
            "type": "OBLIGATION_DUE",
            "channel": "EMAIL",
            "enabled": True,
            "lead_times": [3, 1, 1, 7],
        },
        headers=auth(scoped),
    )
    assert put.status_code == 200, put.json
    # lead_times are de-duplicated and sorted by the service.
    assert put.json["lead_times"] == [1, 3, 7]

    listed = client.get("/api/notification-preferences", headers=auth(scoped))
    assert listed.status_code == 200
    assert len(listed.json) == 1
    assert listed.json[0]["type"] == "OBLIGATION_DUE"
    assert listed.json[0]["enabled"] is True


def test_put_is_upsert(client, mailbox) -> None:
    scoped = _setup(client, mailbox)
    body = {"type": "OBLIGATION_DUE", "channel": "EMAIL", "enabled": True, "lead_times": [1]}
    client.put("/api/notification-preferences", json=body, headers=auth(scoped))
    client.put(
        "/api/notification-preferences",
        json={**body, "enabled": False},
        headers=auth(scoped),
    )

    listed = client.get("/api/notification-preferences", headers=auth(scoped))
    assert len(listed.json) == 1  # updated in place, not duplicated
    assert listed.json[0]["enabled"] is False


def test_unknown_type_is_rejected(client, mailbox) -> None:
    scoped = _setup(client, mailbox)
    bad = client.put(
        "/api/notification-preferences",
        json={"type": "NOPE", "channel": "EMAIL", "enabled": True, "lead_times": []},
        headers=auth(scoped),
    )
    assert bad.status_code == 422
