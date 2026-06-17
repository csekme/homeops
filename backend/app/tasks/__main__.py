"""Worker process entrypoint (plan §4.7, §12.5): ``python -m app.tasks``.

The scheduler + outbox worker run **here**, in their own process — never inside
``create_app()`` / the web workers, which would double-schedule. This builds the app for
config + DB + the email sender, registers the daily sweep on the ``Scheduler`` port, and
then runs the worker poll-loop in the foreground.
"""

from __future__ import annotations

from app import create_app
from app.logging_config import get_logger
from app.tasks import jobs
from app.tasks.notification_worker import run_forever
from app.tasks.scheduler import create_scheduler

log = get_logger("homeops.tasks")


def main() -> None:  # pragma: no cover — process wiring, exercised in deployment
    app = create_app()
    with app.app_context():
        scheduler = create_scheduler()
        scheduler.add_daily_job(
            lambda: _in_context(app, jobs.scan_obligation_reminders),
            hour=6,
            minute=0,
            id="obligation_reminders",
        )
        scheduler.start()
        log.info("tasks.started")
        try:
            run_forever()
        finally:
            scheduler.shutdown()


def _in_context(app, func) -> None:  # pragma: no cover — runs in scheduler thread
    with app.app_context():
        func()


if __name__ == "__main__":  # pragma: no cover
    main()
