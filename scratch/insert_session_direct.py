import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
import sys

sys.path.append("c:\\Users\\Aniket\\Downloads\\Presenza-AI\\backend")
from app.models.session import Session as SessionModel
from app.models.user import User

load_dotenv(dotenv_path="c:\\Users\\Aniket\\Downloads\\Presenza-AI\\backend\\.env")

async def main():
    env_db_url = os.getenv("DATABASE_URL")
    if env_db_url.startswith("postgresql://"):
        SQLALCHEMY_DATABASE_URL = env_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    else:
        SQLALCHEMY_DATABASE_URL = env_db_url
        
    engine = create_async_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    
    async with SessionLocal() as db:
        try:
            # Fetch Aniket user info
            stmt = text("SELECT user_id, org_id FROM users WHERE role_id = 2 LIMIT 1")
            res = await db.execute(stmt)
            row = res.fetchone()
            if not row:
                print("No teacher found in the database!")
                return
            teacher_id, org_id = row
            print(f"Using teacher_id={teacher_id}, org_id={org_id}")
            
            print("Trying to insert a session with class_type='online'...")
            new_session = SessionModel(
                org_id=org_id,
                session_name="Intro to AI Test",
                created_by=teacher_id,
                start_time=None,
                end_time=None,
                location="",
                class_type="online",
                is_approved=True
            )
            db.add(new_session)
            await db.flush()
            print("Successfully flushed! session_id:", new_session.session_id)
            
            # Let's roll it back so we don't pollute the DB
            await db.rollback()
            print("Rolled back successfully!")
        except Exception as e:
            print("ERROR INSERTING:", e)
            
if __name__ == "__main__":
    asyncio.run(main())
