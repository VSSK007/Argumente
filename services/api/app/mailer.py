"""Outgoing email. Uses SMTP when SMTP_HOST is set; otherwise logs the message (local development)."""

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

log = logging.getLogger("argumente.mail")


def delivery() -> str:
    return "smtp" if os.environ.get("SMTP_HOST") else "console"


def send(to: str, subject: str, body: str):
    if delivery() == "console":
        log.warning("EMAIL (console delivery; set SMTP_HOST to send for real)\nTo: %s\nSubject: %s\n\n%s", to, subject, body)
        return
    msg = EmailMessage()
    msg["From"] = os.environ.get("MAIL_FROM", "Argumenté <no-reply@localhost>")
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    host, port = os.environ["SMTP_HOST"], int(os.environ.get("SMTP_PORT", "587"))
    with smtplib.SMTP(host, port, timeout=15) as s:
        if os.environ.get("SMTP_STARTTLS", "1") == "1":
            s.starttls(context=ssl.create_default_context())
        if os.environ.get("SMTP_USER"):
            s.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
        s.send_message(msg)
