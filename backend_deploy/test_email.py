import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from app.core.email import send_email_sync

def test_email():
    recipient = input("Enter recipient email address: ")
    subject = "Presenza AI - Test Email"
    body = "This is a test email from Presenza AI backend to verify SMTP configuration."
    
    print(f"Attempting to send email to {recipient}...")
    print(f"SMTP Server: {os.getenv('SMTP_SERVER')}")
    print(f"SMTP Port: {os.getenv('SMTP_PORT')}")
    print(f"SMTP User: {os.getenv('SMTP_USER')}")
    
    success = send_email_sync(recipient, subject, body)
    
    if success:
        print("\n✅ Email sent successfully! Check your inbox.")
    else:
        print("\n❌ Failed to send email. Check your .env credentials and internet connection.")

if __name__ == "__main__":
    test_email()
