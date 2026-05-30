import asyncio
import os
import sys
from sqlalchemy import create_engine, select, text
from dotenv import load_dotenv

# Ensure we are in the correct directory or add to path
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

load_dotenv()

def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL is not set.")
        return

    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("Fetching teachers from DB...")
        teachers = conn.execute(text("SELECT user_id, org_id, full_name, email FROM users WHERE role_id = 2")).fetchall()
        
        for t in teachers:
            print(f"\nTeacher: {t.full_name} | Email: {t.email} | Org ID: {t.org_id}")
            # Query cameras with this org_id
            cams = conn.execute(text("SELECT camera_id, location, camera_type, status FROM camera_devices WHERE org_id = :org_id"), {"org_id": t.org_id}).fetchall()
            if not cams:
                print("  => NO CAMERAS FOUND under this teacher's organization!")
            for cam in cams:
                print(f"  - Camera ID: {cam.camera_id} | Location: {cam.location} | Type: {cam.camera_type} | Status: {cam.status}")

if __name__ == "__main__":
    main()
