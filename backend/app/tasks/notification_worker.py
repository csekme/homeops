"""Idempotent outbox worker (plan §4.7).

Runs in the dedicated worker process — never the web worker. Each tick claims a batch of
due rows with ``FOR UPDATE SKIP LOCKED`` (so several workers can run side by side), sends
each via the configured ``EmailSender``, and either marks it ``SENT`` or schedules a retry
with exponential backoff. After ``NOTIFICATION_MAX_ATTEMPTS`` the row is parked as ``DEAD``.

The whole batch runs in one bypass-mode transaction: the claim locks are held until the
status updates commit, so a crash mid-tick rolls the rows back to claimable rather than
losing or double-sending them.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from flask import current_app

from app.db.models import Notification
from app.db.rls import session_scope
from app.domain.enums import NotificationType
from app.extensions import get_email_sender
from app.logging_config import get_logger
from app.notifications.email import EmailMessage
from app.notifications.email.messages import build_obligation_due_email, build_overdue_email
from app.repositories import notifications as notif_repo

log = get_logger("homeops.worker")


@dataclass(frozen=True)
class TickResult:
    claimed: int
    sent: int
    failed: int
    dead: int


def _build_email(notification: Notification) -> EmailMessage:
    """Render the outgoing email from the row's type + payload (the dispatch table)."""
    payload = notification.payload
    base = current_app.config["PUBLIC_BASE_URL"]
    url = f"{base}/obligations/{payload.get('obligation_id', '')}"
    common = {
        "to": payload["to"],
        "title": payload["title"],
        "due_date": payload["due_date"],
        "url": url,
        "locale": payload.get("locale", "hu"),
    }
    if notification.type == NotificationType.OBLIGATION_DUE.value:
        return build_obligation_due_email(**common)
    if notification.type == NotificationType.OVERDUE.value:
        return build_overdue_email(**common)
    raise ValueError(f"unsupported notification type: {notification.type}")


def run_once(*, now: datetime | None = None, batch_size: int | None = None) -> TickResult:
    """Process one batch of due notifications. Returns per-outcome counts."""
    now = now or datetime.now(UTC)
    cfg = current_app.config
    batch_size = batch_size or cfg["NOTIFICATION_BATCH_SIZE"]
    max_attempts = cfg["NOTIFICATION_MAX_ATTEMPTS"]
    base_seconds = cfg["NOTIFICATION_BACKOFF_BASE_SECONDS"]
    sender = get_email_sender()

    sent = failed = dead = 0
    with session_scope(bypass_tenant=True) as session:
        batch = notif_repo.claim_batch(session, limit=batch_size, now=now)
        for notification in batch:
            try:
                sender.send(_build_email(notification))
                notif_repo.mark_sent(session, notification)
                sent += 1
            except Exception as exc:
                if notification.attempts + 1 >= max_attempts:
                    notif_repo.mark_dead(session, notification, error=str(exc))
                    dead += 1
                    log.error("notification.dead", dedup_key=notification.dedup_key, error=str(exc))
                else:
                    backoff = base_seconds * (2**notification.attempts)
                    notif_repo.mark_failed(
                        session,
                        notification,
                        error=str(exc),
                        next_attempt_at=now + timedelta(seconds=backoff),
                    )
                    failed += 1
        claimed = len(batch)

    if claimed:
        log.info("worker.tick", claimed=claimed, sent=sent, failed=failed, dead=dead)
    return TickResult(claimed=claimed, sent=sent, failed=failed, dead=dead)


def run_forever(*, interval_seconds: int | None = None) -> None:  # pragma: no cover — loop
    """Poll the outbox until the process is stopped (worker entrypoint)."""
    interval = interval_seconds or current_app.config["NOTIFICATION_POLL_INTERVAL_SECONDS"]
    log.info("worker.started", interval_seconds=interval)
    while True:
        try:
            run_once()
        except Exception:
            log.exception("worker.tick_failed")
        time.sleep(interval)
