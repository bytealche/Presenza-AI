import smtplib
from email.message import EmailMessage
from app.core.config import settings

def send_email_sync(to_email: str, subject: str, body: str):
    """
    Sends an email using standard smtplib (blocking).
    Should be used with FastAPI BackgroundTasks.
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        print("SMTP credentials not set. Mocking email send.")
        print(f"To: {to_email}, Subject: {subject}, Body: {body}")
        return False

    msg = EmailMessage()
    msg["From"] = settings.EMAIL_FROM or settings.SMTP_USER
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

