import os
import asyncio
from dotenv import load_dotenv
from httpx import AsyncClient, ASGITransport
import sys

sys.path.append("c:\\Users\\Aniket\\Downloads\\Presenza-AI\\backend")
from app.main import app
from app.core.security import create_access_token
from app.database.database import SessionLocal
from sqlalchemy import text

load_dotenv(dotenv_path="c:\\Users\\Aniket\\Downloads\\Presenza-AI\\backend\\.env")

def _auth_header(user_id: int, role_id: int, org_id: int, email: str, name: str) -> dict:
    token = create_access_token(
        {"user_id": user_id, "role_id": role_id, "org_id": org_id, "email": email, "full_name": name}
    )
    return {"Authorization": f"Bearer {token}"}

async def main():
    async with SessionLocal() as db:
        # Get a real teacher from the database
        stmt = text("SELECT user_id, org_id, email, full_name FROM users WHERE role_id = 2 LIMIT 1")
        res = await db.execute(stmt)
        row = res.fetchone()
        if not row:
            print("No teacher found in the database!")
            return
        teacher_id, org_id, email, name = row
        print(f"Testing API with User ID: {teacher_id} | Org ID: {org_id} | Name: {name}")

    headers = _auth_header(teacher_id, 2, org_id, email, name)

    # Payload matching the frontend when location is empty and class is online
    payload = {
        "session_name": "CS101 - Intro to AI Test API",
        "start_time": "2026-06-05T18:00:00.000Z",
        "end_time": "2026-06-05T20:00:00.000Z",
        "location": "",
        "class_type": "online"
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post("/sessions", headers=headers, json=payload)
        print("\n--- TEST: Empty location + Online class ---")
        print("Status code:", resp.status_code)
        print("Response:", resp.json())

        # Clean up the session we just created if it succeeded
        if resp.status_code == 200:
            created_id = resp.json()["session_id"]
            print(f"Cleaning up created session ID: {created_id}...")
            async with SessionLocal() as db:
                await db.execute(text("DELETE FROM enrollments WHERE session_id = :sid"), {"sid": created_id})
                await db.execute(text("DELETE FROM sessions WHERE session_id = :sid"), {"sid": created_id})
                await db.commit()
                print("Deleted successfully!")

if __name__ == "__main__":
    asyncio.run(main())
