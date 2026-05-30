import asyncio
import os
import sys
from sqlalchemy import select
from dotenv import load_dotenv

# Ensure we are in backend dir
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

load_dotenv()

from app.database.database import SessionLocal
from app.models.user import User
from app.routers.analytics import get_teacher_stats
from app.routers.sessions import list_sessions
from app.routers.cameras import list_cameras

async def test_teacher_async(user_email):
    print(f"\n==================================================")
    print(f"Testing for Teacher Email: {user_email}")
    print(f"==================================================")
    
    async with SessionLocal() as db:
        # Fetch user
        stmt = select(User).where(User.email == user_email)
        result = await db.execute(stmt)
        user = result.scalars().first()
        if not user:
            print(f"User {user_email} not found in DB!")
            return
            
        print(f"User Found: {user.full_name} | Org ID: {user.org_id} | Role ID: {user.role_id}")
        
        # 1. Test stats
        print("\nCalling get_teacher_stats...")
        try:
            stats = await get_teacher_stats(db=db, current_user=user)
            print(f"Response: {stats}")
        except Exception as e:
            print(f"FAILED with error: {e}")
            import traceback
            traceback.print_exc()
            
        # 2. Test sessions
        print("\nCalling list_sessions...")
        try:
            sessions = await list_sessions(db=db, current_user=user)
            print(f"Response (Sessions Count): {len(sessions)}")
        except Exception as e:
            print(f"FAILED with error: {e}")
            import traceback
            traceback.print_exc()
            
        # 3. Test cameras
        print("\nCalling list_cameras...")
        try:
            cameras = await list_cameras(db=db, current_user=user)
            print(f"Response (Cameras Count): {len(cameras)}")
            for cam in cameras:
                print(f"  - Camera ID: {cam.camera_id} | Location: {cam.location} | Type: {cam.camera_type} | Status: {cam.status}")
        except Exception as e:
            print(f"FAILED with error: {e}")
            import traceback
            traceback.print_exc()

async def main():
    # 1. Teacher 1 (Org ID 15)
    await test_teacher_async("aoczzgopfzvl@dropmail.me")
    
    # 2. Aniket (Org ID 2)
    await test_teacher_async("aktqftknouaqzb@dropmail.me")

if __name__ == "__main__":
    asyncio.run(main())
