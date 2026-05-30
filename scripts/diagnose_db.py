import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

def main():
    db_url = os.getenv("DATABASE_URL")
    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("--- ORGANIZATIONS ---")
        orgs = conn.execute(text("SELECT org_id, org_name FROM organizations")).fetchall()
        for org in orgs:
            print(f"Org ID: {org.org_id} | Name: {org.org_name}")

        print("\n--- USERS ---")
        users = conn.execute(text("SELECT user_id, org_id, role_id, full_name, email FROM users")).fetchall()
        for u in users:
            print(f"User ID: {u.user_id} | Org ID: {u.org_id} | Role ID: {u.role_id} | Name: {u.full_name} | Email: {u.email}")

        print("\n--- CAMERA DEVICES ---")
        cams = conn.execute(text("SELECT camera_id, org_id, location, camera_type, status FROM camera_devices")).fetchall()
        for cam in cams:
            print(f"Camera ID: {cam.camera_id} | Org ID: {cam.org_id} | Location: {cam.location} | Type: {cam.camera_type} | Status: {cam.status}")

        print("\n--- SESSIONS ---")
        sessions = conn.execute(text("SELECT session_id, session_name, org_id, camera_id, created_by FROM sessions")).fetchall()
        for s in sessions:
            print(f"Session ID: {s.session_id} | Name: {s.session_name} | Org ID: {s.org_id} | Camera ID: {s.camera_id} | Created By: {s.created_by}")

if __name__ == "__main__":
    main()
