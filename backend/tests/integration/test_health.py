"""Health/readiness endpoints against a real DB (plan §3.1 acceptance, spec §11)."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.integration


def test_health(client) -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json == {"status": "ok"}


def test_readyz_reports_db_ok(client) -> None:
    r = client.get("/readyz")
    assert r.status_code == 200
    assert r.json["checks"]["database"] == "ok"


def test_secure_cookie_set_when_enabled(_pg) -> None:
    from app import create_app
    from app.notifications.email import MemoryEmailSender

    application = create_app(
        {"DATABASE_URL": _pg["app"], "JWT_SECRET_KEY": "x" * 40, "AUTH_COOKIE_SECURE": True}
    )
    mailbox = MemoryEmailSender()
    application.extensions["email_sender"] = mailbox
    c = application.test_client()

    import re

    c.post(
        "/api/auth/register",
        json={"email": "sec@example.com", "password": "a strong password", "display_name": "S"},
    )
    token = re.search(r"/activate/([A-Za-z0-9_-]+)", mailbox.sent[0].text_body).group(1)
    c.post("/api/auth/activate", json={"token": token})
    login = c.post(
        "/api/auth/login",
        json={"email": "sec@example.com", "password": "a strong password"},
    )

    raw = ";".join(login.headers.getlist("Set-Cookie"))
    assert "Secure" in raw
