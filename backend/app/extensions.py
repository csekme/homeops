"""Extension singletons + per-app service factories (plan §3.1).

Heavy/configurable collaborators (password hasher, email sender, secret cipher) are built
once from config and cached on ``app.extensions`` so the service layer can fetch them via
``current_app`` without re-reading env on every call.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, cast

from flask import current_app
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from app.notifications.email import EmailSender, SmtpEmailSender
from app.security.passwords import Passwords
from app.security.secrets import EnvelopeAesCipher, EnvKeyProvider, SecretCipher

if TYPE_CHECKING:
    from apiflask import APIFlask

limiter = Limiter(key_func=get_remote_address)


def init_services(app: APIFlask) -> None:
    """Build and cache config-driven services on the app."""
    app.extensions["passwords"] = Passwords(
        memory_cost=app.config["ARGON2_MEMORY_COST"],
        time_cost=app.config["ARGON2_TIME_COST"],
        parallelism=app.config["ARGON2_PARALLELISM"],
    )
    app.extensions["email_sender"] = SmtpEmailSender(
        host=app.config["SMTP_HOST"],
        port=app.config["SMTP_PORT"],
        mail_from=app.config["MAIL_FROM"],
        use_tls=app.config["SMTP_USE_TLS"],
        username=app.config["SMTP_USERNAME"],
        password=app.config["SMTP_PASSWORD"],
    )
    app.extensions["secret_cipher"] = EnvelopeAesCipher(
        EnvKeyProvider(kek_b64=app.config["SECRET_KEK"])
    )


def get_passwords() -> Passwords:
    return cast(Passwords, current_app.extensions["passwords"])


def get_email_sender() -> EmailSender:
    return cast(EmailSender, current_app.extensions["email_sender"])


def get_secret_cipher() -> SecretCipher:
    return cast(SecretCipher, current_app.extensions["secret_cipher"])
