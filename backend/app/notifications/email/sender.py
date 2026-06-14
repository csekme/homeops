"""SMTP abstraction (plan §3.7). dev/test → Mailpit (:1025); prod → a transactional
provider. The destination is *only* configuration; calling code talks to ``EmailSender``.
"""

from __future__ import annotations

import smtplib
from dataclasses import dataclass, field
from email.message import EmailMessage as MimeMessage
from typing import Protocol


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    html_body: str
    text_body: str


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class SmtpEmailSender:
    """Plain SMTP adapter. Mailpit needs no auth/TLS; prod providers supply both."""

    def __init__(
        self,
        *,
        host: str,
        port: int,
        mail_from: str,
        use_tls: bool = False,
        username: str | None = None,
        password: str | None = None,
        timeout: float = 10.0,
    ) -> None:
        self._host = host
        self._port = port
        self._mail_from = mail_from
        self._use_tls = use_tls
        self._username = username
        self._password = password
        self._timeout = timeout

    def send(self, message: EmailMessage) -> None:
        mime = MimeMessage()
        mime["From"] = self._mail_from
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime.set_content(message.text_body)
        mime.add_alternative(message.html_body, subtype="html")

        with smtplib.SMTP(self._host, self._port, timeout=self._timeout) as smtp:
            if self._use_tls:
                smtp.starttls()
            if self._username:
                smtp.login(self._username, self._password or "")
            smtp.send_message(mime)


@dataclass
class MemoryEmailSender:
    """Test double — captures sent messages instead of hitting SMTP."""

    sent: list[EmailMessage] = field(default_factory=list)

    def send(self, message: EmailMessage) -> None:
        self.sent.append(message)
