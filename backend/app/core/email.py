import os
import smtplib
from email.message import EmailMessage

SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER) # Default to USER if not set, but likely needs to be explicit

def send_email_sync(to_email: str, subject: str, body: str):
    """
    Sends an email using standard smtplib (blocking).
    Should be used with FastAPI BackgroundTasks.
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        print("SMTP credentials not set. Mocking email send.")
        print(f"To: {to_email}, Subject: {subject}, Body: {body}")
        return False

    msg = EmailMessage()
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(body)

    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False

