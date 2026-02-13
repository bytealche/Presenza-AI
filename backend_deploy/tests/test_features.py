
import requests
import time
import sys
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.database.base import Base
from app.models.verification_code import VerificationCode
from app.models.user import User

# DB Setup
from app.database.database import SessionLocal

BASE_URL = "http://127.0.0.1:8000"

def get_otp_from_db(email):
    db = SessionLocal()
    try:
        vc = db.query(VerificationCode).filter(VerificationCode.email == email).first()
        if vc:
            return vc.code
    finally:
        db.close()
    return None

def register_org(name, email, password):
    print(f"\n--- Registering Org: {email} ---")
    
    # 1. Send OTP
    print("1. Sending OTP...")
    requests.post(f"{BASE_URL}/auth/send-otp", json={"email": email})
    
    # 2. Get OTP
    time.sleep(1)
    otp = get_otp_from_db(email)
    print(f"2. OTP Fetched from DB: {otp}")
    
    if not otp:
        print("FAILED: Could not fetch OTP")
        return False

    # 3. Register
    print("3. Submitting Registration...")
    payload = {
        "org_name": name,
        "email": email,
        "password": password,
        "otp": otp
    }
    resp = requests.post(f"{BASE_URL}/auth/register-organization", json=payload)
    if resp.status_code == 200:
        print("SUCCESS: Org Registered")
        return True
    else:
        print(f"FAILED: {resp.text}")
        return False

def register_faculty(full_name, email, password, org_id):
    print(f"\n--- Registering Faculty: {email} ---")
    
    # 1. Send OTP
    requests.post(f"{BASE_URL}/auth/send-otp", json={"email": email})
    time.sleep(1)
    otp = get_otp_from_db(email)
    print(f"OTP: {otp}")
    
    # 2. Register
    payload = {
        "full_name": full_name,
        "email": email,
        "password": password,
        "role_id": 2, # Faculty
        "org_id": org_id,
        "otp": otp
    }
    resp = requests.post(f"{BASE_URL}/auth/register-user", json=payload)
    if resp.status_code == 200:
        print("SUCCESS: Faculty Registered (Pending Approval)")
        return True
    else:
        print(f"FAILED: {resp.text}")
        return False

def approve_user(admin_token, user_email):
    print(f"\n--- Approving User: {user_email} ---")
    db = SessionLocal()
    user = db.query(User).filter(User.email == user_email).first()
    db.close()
    
    if not user:
        print("User not found in DB")
        return False
        
    headers = {"Authorization": f"Bearer {admin_token}"}
    resp = requests.put(f"{BASE_URL}/users/{user.user_id}/status", json={"status": "active"}, headers=headers)
    
    if resp.status_code == 200:
        print("SUCCESS: User Approved")
        return True
    else:
        print(f"FAILED: {resp.text}")
        return False

def login(email, password):
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json()["access_token"]
    print(f"Login Failed: {resp.text}")
    return None

def create_class(token, name):
    print(f"\n--- Creating Class: {name} ---")
    headers = {"Authorization": f"Bearer {token}"}
    payload = {
        "session_name": name,
        "start_time": "2024-01-01T10:00:00",
        "end_time": "2024-01-01T12:00:00", # Past class, or modify for future
        "location": "Room 101"
    }
    resp = requests.post(f"{BASE_URL}/sessions/", json=payload, headers=headers)
    if resp.status_code == 200:
        print("SUCCESS: Class Created")
        return resp.json()["session_id"]
    else:
        print(f"FAILED: {resp.text}")
        return None

def main():
    ts = int(time.time())
    org_email = f"org_{ts}@test.com"
    org_pass = "admin123"
    
    teacher_email = f"teacher_{ts}@test.com"
    teacher_pass = "teacher123"
    
    # 1. Register Org
    if not register_org(f"TestOrg_{ts}", org_email, org_pass):
        return

    # 2. Login Admin
    admin_token = login(org_email, org_pass)
    if not admin_token:
        return
    
    # Get Org ID? Login token has it but we need it for registration form?
    # Actually, we can assume Org ID is latest? Or parse token?
    # For now, let's query DB to get Org ID.
    db = SessionLocal()
    admin_user = db.query(User).filter(User.email == org_email).first()
    org_id = admin_user.org_id
    db.close()
    print(f"Org ID: {org_id}")

    # 3. Register Faculty
    if not register_faculty("Prof X", teacher_email, teacher_pass, org_id):
        return

    # 4. Approve Faculty
    if not approve_user(admin_token, teacher_email):
        return

    # 5. Login Faculty
    teacher_token = login(teacher_email, teacher_pass)
    if not teacher_token:
        return
        
    # 6. Create Class
    class_id = create_class(teacher_token, f"CS101_{ts}")
    if not class_id:
        return

    # 7. List Classes (as Teacher)
    print("\n--- Listing Classes (Teacher) ---")
    headers = {"Authorization": f"Bearer {teacher_token}"}
    resp = requests.get(f"{BASE_URL}/sessions/", headers=headers)
    print(resp.json())
    
    print("\n\nVERIFICATION COMPLETE")

if __name__ == "__main__":
    main()
