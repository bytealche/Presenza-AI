
import requests
import sys

import os
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

BASE_URL = "http://127.0.0.1:8000"

# 1. Login as Admin
def login_admin():
    print("Logging in as Admin...")
    # Assuming we have a known admin from previous tests or seeding
    # Email: org_1770808452@test.com (from previous logs) or similar
    # Let's use the one from `test_features.py` logs if possible, or register a new one.
    # Actually, let's just register a NEW org to be safe and clean.
    
    # Register Org
    import random
    rand_id = random.randint(1000, 9999)
    email = f"admin_reports_{rand_id}@test.com"
    password = "password123"
    
    # 1. Send OTP
    requests.post(f"{BASE_URL}/auth/send-otp", json={"email": email})
    
    # 2. Get OTP (Mock/DB) - validation step skipped for now, assuming we can just register 
    # Wait, we need real OTP if enabled. 
    # Let's use the DB code to fetch it.
    from app.database.database import SessionLocal
    from app.models.verification_code import VerificationCode
    
    db = SessionLocal()
    code_obj = db.query(VerificationCode).filter(VerificationCode.email == email).order_by(VerificationCode.id.desc()).first()
    db.close()
    
    otp = code_obj.code
    
    # 3. Register Org
    res = requests.post(f"{BASE_URL}/auth/register-organization", json={
        "org_name": f"Report Org {rand_id}",
        "email": email,
        "password": password,
        "otp": otp
    })
    if res.status_code != 200:
        print("Failed to register org:", res.text)
        sys.exit(1)
        
    # 4. Login
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    token = res.json()["access_token"]
    print("Admin Logged In.")
    return token, email

def create_faculty(admin_token, org_email):
    print("Creating Faculty...")
    # Register Faculty
    rand_id = org_email.split('_')[2].split('@')[0]
    email = f"faculty_{rand_id}@test.com"
    password = "password123"
    
    # OTP
    requests.post(f"{BASE_URL}/auth/send-otp", json={"email": email})
    
    from app.database.database import SessionLocal
    from app.models.verification_code import VerificationCode
    db = SessionLocal()
    code_obj = db.query(VerificationCode).filter(VerificationCode.email == email).order_by(VerificationCode.id.desc()).first()
    db.close()
    otp = code_obj.code
    
    # Get Org ID? We need it for faculty registration?
    # Actually faculty selects it.
    # We need to know the Org ID.
    # The Admin can get it from /organizations/me or similar?
    # Let's get list of orgs and find ours.
    # Or just use the one we just made. 
    # Wait, fetching orgs requires no auth? 
    res = requests.get(f"{BASE_URL}/organizations")
    # Finding "Report Org {rand_id}"
    orgs = res.json()
    my_org = next((o for o in orgs if f"Report Org {rand_id}" in o["org_name"]), None)
    org_id = my_org["org_id"]

    res = requests.post(f"{BASE_URL}/auth/register-user", json={
        "full_name": "Dr. House",
        "email": email,
        "password": password,
        "otp": otp,
        "role_id": 2,
        "org_id": org_id
    })
    if res.status_code != 200:
        print("Failed to register faculty:", res.text)
        sys.exit(1)
        
    print("Faculty Registered (Pending).")
    
    # Approve Faculty
    # Get User ID first.
    # Admin lists users (pending)
    res = requests.get(f"{BASE_URL}/users", headers={"Authorization": f"Bearer {admin_token}"})
    users = res.json()
    faculty_user = next(u for u in users if u["email"] == email)
    
    requests.put(f"{BASE_URL}/users/{faculty_user['user_id']}/status", 
                 json={"status": "active"},
                 headers={"Authorization": f"Bearer {admin_token}"})
    print("Faculty Approved.")
    
    return faculty_user['user_id'], email, password

def create_class(faculty_user_id, faculty_email, faculty_password):
    print("Creating Class...")
    # Login Faculty
    res = requests.post(f"{BASE_URL}/auth/login", json={"email": faculty_email, "password": faculty_password})
    token = res.json()["access_token"]
    
    # Create Session
    res = requests.post(f"{BASE_URL}/sessions/", json={
        "session_name": "Diagnostics 101",
        "start_time": "2026-02-12T10:00:00",
        "end_time": "2026-02-12T11:00:00",
        "location": "Room 1"
    }, headers={"Authorization": f"Bearer {token}"})
    
    if res.status_code != 200:
        print("Failed to create session:", res.text)
        sys.exit(1)
        
    session = res.json()
    print(f"Class Created: {session['session_id']}")
    return session['session_id'], token

def test_reports(admin_token, faculty_id, session_id):
    print("\n--- Testing Reports Endpoints ---")
    
    # 1. GET /users?role_id=2 (Should find our faculty)
    res = requests.get(f"{BASE_URL}/users", params={"role_id": 2}, headers={"Authorization": f"Bearer {admin_token}"})
    users = res.json()
    found = any(u['user_id'] == faculty_id for u in users)
    print(f"1. Filter Users by Role (Faculty): {'PASSED' if found else 'FAILED'}")
    if not found:
        print("Users found:", users)

    # 2. GET /sessions?teacher_id={faculty_id} (Should find our class)
    res = requests.get(f"{BASE_URL}/sessions", params={"teacher_id": faculty_id}, headers={"Authorization": f"Bearer {admin_token}"})
    sessions = res.json()
    found = any(s['session_id'] == session_id for s in sessions)
    print(f"2. Filter Sessions by Teacher: {'PASSED' if found else 'FAILED'}")
    if not found:
        print("Sessions found:", sessions)

    # 3. GET /attendance/session/{session_id} (Should be empty list initially)
    res = requests.get(f"{BASE_URL}/attendance/session/{session_id}", headers={"Authorization": f"Bearer {admin_token}"})
    attendance = res.json()
    print(f"3. Get Session Attendance: {'PASSED' if isinstance(attendance, list) else 'FAILED'}")
    print(f"   Records count: {len(attendance)}")

if __name__ == "__main__":
    try:
        admin_token, admin_email = login_admin()
        faculty_id, f_email, f_pass = create_faculty(admin_token, admin_email)
        session_id, f_token = create_class(faculty_id, f_email, f_pass)
        test_reports(admin_token, faculty_id, session_id)
    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
