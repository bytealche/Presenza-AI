import os
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

host = os.getenv("SMTP_HOST")
port = int(os.getenv("SMTP_PORT", 587))
user = os.getenv("SMTP_USER")
pwd = os.getenv("SMTP_PASSWORD")
sender = os.getenv("EMAIL_FROM")

print(f"Connecting to {host}:{port} with user {user}...")

try:
    server = smtplib.SMTP(host, port)
    server.starttls()
    server.login(user, pwd)
    print("Login successful! Sending test email...")
    
    msg = MIMEText("Test OTP email from Presenza AI")
    msg["Subject"] = "OTP Test"
    msg["From"] = sender
    msg["To"] = sender
    
    server.sendmail(sender, [sender], msg.as_string())
    server.quit()
    print("Email sent successfully!")
except Exception as e:
    print(f"Failed to send email: {e}")
