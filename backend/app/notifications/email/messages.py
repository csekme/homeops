"""Localized email builders (plan §3.7). HU default / EN, rendered via Jinja templates.

Keeps copy out of the SMTP adapter so the same ``EmailSender`` serves any message type.
"""

from __future__ import annotations

from jinja2 import Environment, PackageLoader, select_autoescape

from app.notifications.email.sender import EmailMessage

_env = Environment(
    loader=PackageLoader("app.notifications.email", "templates"),
    autoescape=select_autoescape(["html", "xml"]),
)

# Per-locale copy. Keys mirror the frontend i18n `auth` namespace where it overlaps.
_ACTIVATION_COPY: dict[str, dict[str, str]] = {
    "hu": {
        "subject": "Erősítsd meg a HomeOps fiókodat",
        "heading": "Üdv a HomeOps-ban!",
        "intro": "Köszönjük a regisztrációt. A fiók aktiválásához kattints az alábbi gombra.",
        "cta": "Fiók aktiválása",
        "fallback": "Ha a gomb nem működik, másold be ezt a linket a böngészőbe:",
        "expiry": "A link korlátozott ideig érvényes. Ha nem te kérted, hagyd figyelmen kívül.",
    },
    "en": {
        "subject": "Confirm your HomeOps account",
        "heading": "Welcome to HomeOps!",
        "intro": "Thanks for signing up. Activate your account with the button below.",
        "cta": "Activate account",
        "fallback": "If the button doesn't work, paste this link into your browser:",
        "expiry": (
            "This link is valid for a limited time. If you didn't request it, ignore this email."
        ),
    },
}


def _copy(locale: str) -> dict[str, str]:
    return _ACTIVATION_COPY.get(locale, _ACTIVATION_COPY["hu"])


def build_activation_email(*, to: str, activation_url: str, locale: str = "hu") -> EmailMessage:
    copy = _copy(locale)
    context = {"activation_url": activation_url, **copy}
    html = _env.get_template("activation.html.j2").render(**context)
    text = _env.get_template("activation.txt.j2").render(**context)
    return EmailMessage(to=to, subject=copy["subject"], html_body=html, text_body=text)
