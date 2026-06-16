"""Obligation CRUD, recurrence and derived-status flows (plan §4.4 acceptance)."""

from __future__ import annotations

from datetime import date, timedelta

import pytest
from tests.integration._helpers import auth, create_household_and_switch, signup

pytestmark = pytest.mark.integration


def _setup(client, mailbox, email="owner@example.com"):
    token = signup(client, mailbox, email, "Owner")
    household_id, scoped = create_household_and_switch(client, token, "Home")
    return household_id, scoped


def test_create_list_get_roundtrip(client, mailbox) -> None:
    _hid, scoped = _setup(client, mailbox)
    due = (date.today() + timedelta(days=30)).isoformat()

    created = client.post(
        "/api/obligations",
        json={"title": "Pay rent", "due_date": due, "category": "housing"},
        headers=auth(scoped),
    )
    assert created.status_code == 201, created.json
    obligation_id = created.json["id"]
    assert created.json["status"] == "UPCOMING"
    assert created.json["due_date"] == due

    fetched = client.get(f"/api/obligations/{obligation_id}", headers=auth(scoped))
    assert fetched.status_code == 200
    assert fetched.json["title"] == "Pay rent"

    listed = client.get("/api/obligations", headers=auth(scoped))
    assert listed.status_code == 200
    assert len(listed.json) == 1


def test_derived_status_overdue_and_due(client, mailbox) -> None:
    _hid, scoped = _setup(client, mailbox)

    past = client.post(
        "/api/obligations",
        json={"title": "Late", "due_date": (date.today() - timedelta(days=2)).isoformat()},
        headers=auth(scoped),
    )
    assert past.json["status"] == "OVERDUE"

    soon = client.post(
        "/api/obligations",
        json={
            "title": "Soon",
            "due_date": (date.today() + timedelta(days=3)).isoformat(),
            "lead_time_days": 7,
        },
        headers=auth(scoped),
    )
    assert soon.json["status"] == "DUE"


def test_recurring_complete_spawns_next(client, mailbox) -> None:
    _hid, scoped = _setup(client, mailbox)
    created = client.post(
        "/api/obligations",
        json={
            "title": "Monthly bill",
            "due_date": "2026-06-15",
            "rrule": "FREQ=MONTHLY;BYMONTHDAY=15",
        },
        headers=auth(scoped),
    )
    obligation_id = created.json["id"]

    completed = client.post(
        f"/api/obligations/{obligation_id}/complete", headers=auth(scoped)
    )
    assert completed.status_code == 200
    assert completed.json["status"] == "DONE"
    assert completed.json["completed_at"] is not None

    listed = client.get("/api/obligations", headers=auth(scoped)).json
    due_dates = sorted(o["due_date"] for o in listed)
    assert due_dates == ["2026-06-15", "2026-07-15"]
    spawned = next(o for o in listed if o["due_date"] == "2026-07-15")
    assert spawned["status"] in {"UPCOMING", "DUE", "OVERDUE"}
    assert spawned["rrule"] == "FREQ=MONTHLY;BYMONTHDAY=15"


def test_skip_recurring_spawns_next_without_completed_at(client, mailbox) -> None:
    _hid, scoped = _setup(client, mailbox)
    created = client.post(
        "/api/obligations",
        json={"title": "Weekly", "due_date": "2026-06-15", "rrule": "FREQ=WEEKLY"},
        headers=auth(scoped),
    )
    skipped = client.post(
        f"/api/obligations/{created.json['id']}/skip", headers=auth(scoped)
    )
    assert skipped.json["status"] == "SKIPPED"
    assert skipped.json["completed_at"] is None

    listed = client.get("/api/obligations", headers=auth(scoped)).json
    assert {o["due_date"] for o in listed} == {"2026-06-15", "2026-06-22"}


def test_one_off_complete_spawns_nothing(client, mailbox) -> None:
    _hid, scoped = _setup(client, mailbox)
    created = client.post(
        "/api/obligations",
        json={"title": "Once", "due_date": "2026-06-20"},
        headers=auth(scoped),
    )
    client.post(f"/api/obligations/{created.json['id']}/complete", headers=auth(scoped))
    listed = client.get("/api/obligations", headers=auth(scoped)).json
    assert len(listed) == 1
    assert listed[0]["status"] == "DONE"


def test_update_changes_fields(client, mailbox) -> None:
    _hid, scoped = _setup(client, mailbox)
    created = client.post(
        "/api/obligations",
        json={"title": "Old", "due_date": "2026-06-20"},
        headers=auth(scoped),
    )
    updated = client.patch(
        f"/api/obligations/{created.json['id']}",
        json={"title": "New", "category": "bills"},
        headers=auth(scoped),
    )
    assert updated.status_code == 200
    assert updated.json["title"] == "New"
    assert updated.json["category"] == "bills"


def test_filters_by_status_and_due_range(client, mailbox) -> None:
    _hid, scoped = _setup(client, mailbox)
    for title, due in [("A", "2026-06-20"), ("B", "2026-07-20"), ("C", "2026-08-20")]:
        client.post(
            "/api/obligations",
            json={"title": title, "due_date": due},
            headers=auth(scoped),
        )

    ranged = client.get(
        "/api/obligations?due_from=2026-07-01&due_to=2026-07-31", headers=auth(scoped)
    )
    assert [o["title"] for o in ranged.json] == ["B"]

    upcoming = client.get("/api/obligations?status=UPCOMING", headers=auth(scoped))
    assert len(upcoming.json) == 3


def test_delete_soft_deletes(client, mailbox) -> None:
    _hid, scoped = _setup(client, mailbox)
    created = client.post(
        "/api/obligations",
        json={"title": "Bye", "due_date": "2026-06-20"},
        headers=auth(scoped),
    )
    obligation_id = created.json["id"]

    deleted = client.delete(f"/api/obligations/{obligation_id}", headers=auth(scoped))
    assert deleted.status_code == 204

    assert client.get(f"/api/obligations/{obligation_id}", headers=auth(scoped)).status_code == 404
    assert client.get("/api/obligations", headers=auth(scoped)).json == []


def test_invalid_rrule_is_422(client, mailbox) -> None:
    _hid, scoped = _setup(client, mailbox)
    bad = client.post(
        "/api/obligations",
        json={"title": "Broken", "due_date": "2026-06-20", "rrule": "NOT-AN-RRULE"},
        headers=auth(scoped),
    )
    assert bad.status_code == 422


def test_missing_obligation_is_404(client, mailbox) -> None:
    import uuid

    _hid, scoped = _setup(client, mailbox)
    r = client.get(f"/api/obligations/{uuid.uuid4()}", headers=auth(scoped))
    assert r.status_code == 404
