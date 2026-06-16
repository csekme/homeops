import json
from datetime import date
from pathlib import Path

import pytest

from app.domain.recurrence import RecurrenceError, next_occurrence

# Shared drift fixture, consumed by both this suite and the @homeops/core Vitest
# suite — keeps the Python and TS recurrence math in lockstep (plan §4.1).
_FIXTURE = Path(__file__).parents[4] / "tests" / "fixtures" / "recurrence_cases.json"
_CASES = json.loads(_FIXTURE.read_text())["next_occurrence"]


@pytest.mark.parametrize("case", _CASES, ids=[c["name"] for c in _CASES])
def test_next_occurrence_shared_fixture(case: dict) -> None:
    after = date.fromisoformat(case["after"])
    result = next_occurrence(case["rrule"], after)
    expected = date.fromisoformat(case["expected"]) if case["expected"] else None
    assert result == expected


def test_yearly_with_explicit_dtstart() -> None:
    rule = "DTSTART:20240115T000000Z\nRRULE:FREQ=YEARLY"
    assert next_occurrence(rule, date(2024, 6, 1)) == date(2025, 1, 15)


def test_count_bounded_rule_exhausts_to_none() -> None:
    rule = "DTSTART:20240101T000000Z\nRRULE:FREQ=YEARLY;COUNT=1"
    assert next_occurrence(rule, date(2025, 1, 1)) is None


def test_empty_rule_raises() -> None:
    with pytest.raises(RecurrenceError):
        next_occurrence("   ", date(2024, 1, 1))


def test_invalid_rule_raises() -> None:
    with pytest.raises(RecurrenceError):
        next_occurrence("NOT-AN-RRULE", date(2024, 1, 1))


def test_after_must_be_a_date() -> None:
    with pytest.raises(RecurrenceError):
        next_occurrence("FREQ=YEARLY", "2024-01-01")  # type: ignore[arg-type]
