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


# Invitation copy. ``{household}`` / ``{role}`` are interpolated per message.
_INVITATION_COPY: dict[str, dict[str, str]] = {
    "hu": {
        "subject": "Meghívás a(z) {household} háztartásba",
        "heading": "Meghívást kaptál!",
        "intro": "Meghívtak a(z) „{household}” háztartásba {role} szerepkörrel. "
        "A csatlakozáshoz kattints az alábbi gombra.",
        "cta": "Csatlakozás a háztartáshoz",
        "fallback": "Ha a gomb nem működik, másold be ezt a linket a böngészőbe:",
        "expiry": (
            "A meghívó korlátozott ideig érvényes. "
            "Ha nem számítottál rá, hagyd figyelmen kívül."
        ),
    },
    "en": {
        "subject": "Invitation to join {household}",
        "heading": "You've been invited!",
        "intro": "You've been invited to join the “{household}” household as {role}. "
        "Click the button below to join.",
        "cta": "Join household",
        "fallback": "If the button doesn't work, paste this link into your browser:",
        "expiry": (
            "This invitation is valid for a limited time. "
            "If you didn't expect it, ignore this email."
        ),
    },
}


# Obligation reminder copy. ``{title}`` / ``{due_date}`` are interpolated per message.
_OBLIGATION_DUE_COPY: dict[str, dict[str, str]] = {
    "hu": {
        "subject": "Emlékeztető: „{title}” hamarosan esedékes",
        "heading": "Közelgő teendő",
        "intro": "A(z) „{title}” teendő hamarosan esedékes.",
        "detail": "Esedékesség: {due_date}",
        "cta": "Teendő megnyitása",
        "footer": "Ezt az emlékeztetőt a HomeOps küldte. A beállításoknál kikapcsolhatod.",
    },
    "en": {
        "subject": "Reminder: “{title}” is due soon",
        "heading": "Upcoming obligation",
        "intro": "Your “{title}” obligation is due soon.",
        "detail": "Due date: {due_date}",
        "cta": "Open obligation",
        "footer": "HomeOps sent you this reminder. You can turn it off in settings.",
    },
}

_OVERDUE_COPY: dict[str, dict[str, str]] = {
    "hu": {
        "subject": "Lejárt: „{title}”",
        "heading": "Lejárt teendő",
        "intro": "A(z) „{title}” teendő lejárt.",
        "detail": "Volt esedékesség: {due_date}",
        "cta": "Teendő megnyitása",
        "footer": "Ezt az emlékeztetőt a HomeOps küldte. A beállításoknál kikapcsolhatod.",
    },
    "en": {
        "subject": "Overdue: “{title}”",
        "heading": "Overdue obligation",
        "intro": "Your “{title}” obligation is overdue.",
        "detail": "Was due: {due_date}",
        "cta": "Open obligation",
        "footer": "HomeOps sent you this reminder. You can turn it off in settings.",
    },
}


def _copy(locale: str) -> dict[str, str]:
    return _ACTIVATION_COPY.get(locale, _ACTIVATION_COPY["hu"])


def _obligation_reminder_email(
    *,
    copy_table: dict[str, dict[str, str]],
    to: str,
    title: str,
    due_date: str,
    url: str,
    locale: str,
) -> EmailMessage:
    raw = copy_table.get(locale, copy_table["hu"])
    copy = {key: value.format(title=title, due_date=due_date) for key, value in raw.items()}
    context = {"url": url, **copy}
    html = _env.get_template("obligation_reminder.html.j2").render(**context)
    text = _env.get_template("obligation_reminder.txt.j2").render(**context)
    return EmailMessage(to=to, subject=copy["subject"], html_body=html, text_body=text)


def build_obligation_due_email(
    *, to: str, title: str, due_date: str, url: str, locale: str = "hu"
) -> EmailMessage:
    return _obligation_reminder_email(
        copy_table=_OBLIGATION_DUE_COPY,
        to=to,
        title=title,
        due_date=due_date,
        url=url,
        locale=locale,
    )


def build_overdue_email(
    *, to: str, title: str, due_date: str, url: str, locale: str = "hu"
) -> EmailMessage:
    return _obligation_reminder_email(
        copy_table=_OVERDUE_COPY,
        to=to,
        title=title,
        due_date=due_date,
        url=url,
        locale=locale,
    )


def _invitation_copy(locale: str) -> dict[str, str]:
    return _INVITATION_COPY.get(locale, _INVITATION_COPY["hu"])


def build_activation_email(*, to: str, activation_url: str, locale: str = "hu") -> EmailMessage:
    copy = _copy(locale)
    context = {"activation_url": activation_url, **copy}
    html = _env.get_template("activation.html.j2").render(**context)
    text = _env.get_template("activation.txt.j2").render(**context)
    return EmailMessage(to=to, subject=copy["subject"], html_body=html, text_body=text)


def build_invitation_email(
    *, to: str, invite_url: str, household_name: str, role: str, locale: str = "hu"
) -> EmailMessage:
    raw = _invitation_copy(locale)
    # Interpolate the household/role into the copy before rendering.
    copy = {
        key: value.format(household=household_name, role=role) for key, value in raw.items()
    }
    context = {"invite_url": invite_url, **copy}
    html = _env.get_template("invitation.html.j2").render(**context)
    text = _env.get_template("invitation.txt.j2").render(**context)
    return EmailMessage(to=to, subject=copy["subject"], html_body=html, text_body=text)
