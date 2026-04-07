import smtplib
from email.message import EmailMessage
import urllib.request
import json
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_email_sync(to_email: str, subject: str, body: str):
    """
    Sends an email using standard smtplib (blocking), but uses 
    Brevo's HTTP API (port 443) preferentially to bypass HF firewalls.
    Should be used with FastAPI BackgroundTasks.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP credentials not set. Mocking email send.")
        return False

    sender_email = settings.EMAIL_FROM or settings.SMTP_USER
    
    # 1. Try Brevo HTTP API (Bypasses Hugging Face Port blocks on 587/2525)
    if "brevo" in settings.SMTP_HOST.lower():
        try:
            url = "https://api.brevo.com/v3/smtp/email"
            headers = {
                "accept": "application/json",
                "api-key": settings.SMTP_PASSWORD,
                "content-type": "application/json"
            }
            payload = {
                "sender": {"email": sender_email},
                "to": [{"email": to_email}],
                "subject": subject,
                "textContent": body
            }
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode('utf-8'), 
                headers=headers, 
                method='POST'
            )
            try:
                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status in [200, 201, 202]:
                        logger.info(f"Successfully sent OTP via Brevo API to {to_email}")
                        return True
            except urllib.error.HTTPError as e:
                logger.error(f"Brevo HTTP API explicitly rejected the email: {e.code} {e.read().decode('utf-8')}")
                return False  # Do NOT fallback to SMTP if Brevo explicitly rejected our payload
        except Exception as e:
            logger.error(f"Brevo HTTP request setup failed: {e}")
            return False

    # 2. Fallback to classic SMTP for non-Brevo hosts
    msg = EmailMessage()
    msg["From"] = sender_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Successfully sent OTP via SMTP to {to_email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email via SMTP: {e}")
        return False

