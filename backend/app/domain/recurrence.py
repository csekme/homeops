"""Recurrence + status derivation — backend mirror of ``core/recurrence.ts``
and ``core/status.ts``.

Obligations carry a calendar ``due_date`` (a ``date``, not a timestamp) and an
optional iCal RRULE. :func:`next_occurrence` previews the next due date; the web
and mobile clients run the TS twin so previews match without a round trip. A
shared fixture (``tests/fixtures/recurrence_cases.json``) pins the two
implementations together (plan §4.1).
"""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from dateutil.rrule import rrulestr

from app.domain.enums import ObligationStatus


class RecurrenceError(Exception):
    """Raised when an RRULE string cannot be parsed or is empty."""


def next_occurrence(rrule: str, after: date) -> date | None:
    """Return the next occurrence strictly after ``after``, or ``None`` if the
    rule has no further occurrences.

    ``rrule`` accepts a bare rule (``FREQ=MONTHLY;BYMONTHDAY=15``) or a full
    ``DTSTART:...\\nRRULE:...`` block. When the rule carries no ``DTSTART``,
    ``after`` is used as the anchor so the schedule is evaluated relative to the
    query point — matching the TS contract.

    Calendar math only: ``BYMONTHDAY=31`` skips months without a 31st (iCal
    semantics, not clamped). Times are irrelevant — we operate on dates.
    """
    if not isinstance(rrule, str) or rrule.strip() == "":
        raise RecurrenceError("RRULE string must be a non-empty string")
    if not isinstance(after, date):
        raise RecurrenceError("`after` must be a date")

    anchor = datetime(after.year, after.month, after.day)
    try:
        rule = rrulestr(rrule.strip(), dtstart=anchor)
    except (ValueError, TypeError) as exc:
        raise RecurrenceError(f'Failed to parse RRULE "{rrule}": {exc}') from exc

    # inc=False -> strictly after the anchor. A rule whose DTSTART carries a
    # timezone (e.g. ``DTSTART:...Z``) yields tz-aware occurrences, which cannot
    # be compared to a naive anchor — retry with a UTC-aware anchor in that case.
    try:
        nxt = rule.after(anchor, inc=False)
    except TypeError:
        nxt = rule.after(anchor.replace(tzinfo=UTC), inc=False)
    return nxt.date() if nxt is not None else None


def derive_status(
    due_date: date,
    status: ObligationStatus,
    today: date,
    lead_time_days: int = 0,
) -> ObligationStatus:
    """Derive the display status of an obligation.

    Precedence mirrors ``core/status.ts``: terminal stored states win, then the
    time-based derivation:

        SKIPPED  → stored, terminal (wins over everything)
        DONE     → stored, terminal
        OVERDUE  → ``today`` is past ``due_date``
        DUE      → ``today`` is within ``lead_time_days`` of ``due_date``
        UPCOMING → further out than the lead window
    """
    if status is ObligationStatus.SKIPPED:
        return ObligationStatus.SKIPPED
    if status is ObligationStatus.DONE:
        return ObligationStatus.DONE

    if today > due_date:
        return ObligationStatus.OVERDUE

    lead = timedelta(days=max(0, lead_time_days))
    if today >= due_date - lead:
        return ObligationStatus.DUE

    return ObligationStatus.UPCOMING
