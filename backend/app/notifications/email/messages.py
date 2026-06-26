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


# Household invitation copy. ``{household}`` is interpolated at build time.
_INVITATION_COPY: dict[str, dict[str, str]] = {
    "hu": {
        "subject": "Meghívást kaptál egy HomeOps háztartásba",
        "heading": "Csatlakozz a(z) {household} háztartáshoz",
        "intro": (
            "Meghívtak, hogy csatlakozz a(z) {household} háztartáshoz a HomeOps-on. "
            "A csatlakozáshoz kattints az alábbi gombra."
        ),
        "cta": "Meghívás elfogadása",
        "fallback": "Ha a gomb nem működik, másold be ezt a linket a böngészőbe:",
        "expiry": (
            "A meghívó korlátozott ideig érvényes. Ha nincs még fiókod, először regisztrálj "
            "ezzel az e-mail-címmel, majd fogadd el a meghívót."
        ),
    },
    "en": {
        "subject": "You've been invited to a HomeOps household",
        "heading": "Join the {household} household",
        "intro": (
            "You've been invited to join the {household} household on HomeOps. "
            "Click the button below to join."
        ),
        "cta": "Accept invitation",
        "fallback": "If the button doesn't work, paste this link into your browser:",
        "expiry": (
            "This invitation is valid for a limited time. If you don't have an account yet, "
            "register with this email address first, then accept the invitation."
        ),
    },
}


# Password-reset copy (feature plan §#1).
_PASSWORD_RESET_COPY: dict[str, dict[str, str]] = {
    "hu": {
        "subject": "Állítsd vissza a HomeOps jelszavadat",
        "heading": "Jelszó visszaállítása",
        "intro": (
            "Jelszó-visszaállítást kértél a HomeOps-fiókodhoz. Új jelszó megadásához kattints "
            "az alábbi gombra."
        ),
        "cta": "Új jelszó megadása",
        "fallback": "Ha a gomb nem működik, másold be ezt a linket a böngészőbe:",
        "expiry": (
            "A link rövid ideig érvényes, és csak egyszer használható fel. Ha nem te kérted, "
            "hagyd figyelmen kívül ezt az e-mailt — a jelszavad változatlan marad."
        ),
    },
    "en": {
        "subject": "Reset your HomeOps password",
        "heading": "Reset your password",
        "intro": (
            "You requested a password reset for your HomeOps account. Click the button below "
            "to choose a new password."
        ),
        "cta": "Set a new password",
        "fallback": "If the button doesn't work, paste this link into your browser:",
        "expiry": (
            "This link is valid for a limited time and can be used only once. If you didn't "
            "request it, ignore this email — your password stays unchanged."
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


def build_invitation_email(
    *, to: str, invite_url: str, household_name: str, locale: str = "hu"
) -> EmailMessage:
    raw = _INVITATION_COPY.get(locale, _INVITATION_COPY["hu"])
    copy = {key: value.format(household=household_name) for key, value in raw.items()}
    context = {"invite_url": invite_url, **copy}
    html = _env.get_template("invitation.html.j2").render(**context)
    text = _env.get_template("invitation.txt.j2").render(**context)
    return EmailMessage(to=to, subject=copy["subject"], html_body=html, text_body=text)


def build_password_reset_email(
    *, to: str, reset_url: str, locale: str = "hu"
) -> EmailMessage:
    copy = _PASSWORD_RESET_COPY.get(locale, _PASSWORD_RESET_COPY["hu"])
    context = {"reset_url": reset_url, **copy}
    html = _env.get_template("password_reset.html.j2").render(**context)
    text = _env.get_template("password_reset.txt.j2").render(**context)
    return EmailMessage(to=to, subject=copy["subject"], html_body=html, text_body=text)
