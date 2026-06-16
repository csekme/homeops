from datetime import date

import pytest

from app.domain.enums import ObligationStatus
from app.domain.recurrence import derive_status

DUE = date(2026, 6, 20)


def test_upcoming_well_before_lead_window() -> None:
    assert derive_status(DUE, ObligationStatus.UPCOMING, date(2026, 6, 10), lead_time_days=3) == (
        ObligationStatus.UPCOMING
    )


def test_due_inside_lead_window() -> None:
    assert derive_status(DUE, ObligationStatus.UPCOMING, date(2026, 6, 18), lead_time_days=3) == (
        ObligationStatus.DUE
    )


def test_due_exactly_at_start_of_lead_window() -> None:
    assert derive_status(DUE, ObligationStatus.UPCOMING, date(2026, 6, 17), lead_time_days=3) == (
        ObligationStatus.DUE
    )


def test_due_on_the_due_date() -> None:
    assert derive_status(DUE, ObligationStatus.UPCOMING, DUE, lead_time_days=3) == (
        ObligationStatus.DUE
    )


def test_overdue_after_due_date() -> None:
    assert derive_status(DUE, ObligationStatus.UPCOMING, date(2026, 6, 21), lead_time_days=3) == (
        ObligationStatus.OVERDUE
    )


def test_no_lead_window_is_due_only_on_due_date() -> None:
    assert derive_status(DUE, ObligationStatus.UPCOMING, date(2026, 6, 19)) == (
        ObligationStatus.UPCOMING
    )
    assert derive_status(DUE, ObligationStatus.UPCOMING, DUE) == ObligationStatus.DUE


@pytest.mark.parametrize("today", [date(2026, 6, 1), DUE, date(2026, 7, 1)])
def test_done_is_terminal(today: date) -> None:
    assert derive_status(DUE, ObligationStatus.DONE, today, lead_time_days=3) == (
        ObligationStatus.DONE
    )


@pytest.mark.parametrize("today", [date(2026, 6, 1), DUE, date(2026, 7, 1)])
def test_skipped_is_terminal(today: date) -> None:
    assert derive_status(DUE, ObligationStatus.SKIPPED, today, lead_time_days=3) == (
        ObligationStatus.SKIPPED
    )


def test_negative_lead_time_clamped_to_zero() -> None:
    assert derive_status(DUE, ObligationStatus.UPCOMING, date(2026, 6, 19), lead_time_days=-5) == (
        ObligationStatus.UPCOMING
    )
