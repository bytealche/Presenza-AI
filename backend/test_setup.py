import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.database.database import SessionLocal
from app.models.session import Session as SessionModel
from app.models.camera import CameraDevice
from app.models.user import User
from datetime import datetime, timedelta

async def setup_test_session():
    async with SessionLocal() as db:
        # Create Dummy Camera if it doesn't exist
        cam = CameraDevice(camera_id=999, org_id=1, location="Test Camera", camera_type="mobile", connection_url="")
        
        try:
             db.add(cam)
             await db.commit()
        except Exception:
             await db.rollback() # Assume exists

        now = datetime.utcnow()
        # Create active session for camera 999
        session = SessionModel(
            org_id=1,
            session_name="Stream Test Session",
            created_by=1,
            camera_id=999,
            start_time=now - timedelta(minutes=10),
            end_time=now + timedelta(minutes=50),
            location="Test Sandbox"
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)
        print(f"Created active session {session.session_id} for Camera 999.")

if __name__ == "__main__":
    asyncio.run(setup_test_session())
