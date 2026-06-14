"""Email sending: a transport-agnostic port + SMTP adapter (plan §3.7, spec §5.7)."""

from app.notifications.email.sender import (
    EmailMessage,
    EmailSender,
    MemoryEmailSender,
    SmtpEmailSender,
)

__all__ = ["EmailMessage", "EmailSender", "MemoryEmailSender", "SmtpEmailSender"]
