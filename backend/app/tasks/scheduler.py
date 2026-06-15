"""Scheduler port + APScheduler adapter (plan §10.6, §3.0).

Hard ordering constraint (plan §12.5): the scheduler runs in a **separate worker process**,
never in the web worker — otherwise N web workers double-schedule. ``create_app()`` must
NOT start it; only ``worker.py`` does. The Celery beat swap-in (Phase 3/4) sits behind
this same ``Scheduler`` port.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Protocol


class Scheduler(Protocol):
    def add_daily_job(
        self, func: Callable[[], None], *, hour: int, minute: int, id: str
    ) -> None: ...

    def start(self) -> None: ...

    def shutdown(self) -> None: ...


def create_scheduler() -> Scheduler:
    """Build the APScheduler-backed scheduler. Call from the worker entrypoint only."""
    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    class _ApScheduler:
        def __init__(self) -> None:
            self._sched = BackgroundScheduler(timezone="UTC")

        def add_daily_job(
            self, func: Callable[[], None], *, hour: int, minute: int, id: str
        ) -> None:
            self._sched.add_job(
                func, CronTrigger(hour=hour, minute=minute), id=id, replace_existing=True
            )

        def start(self) -> None:
            self._sched.start()

        def shutdown(self) -> None:
            self._sched.shutdown()

    return _ApScheduler()
