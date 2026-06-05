import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

load_dotenv(dotenv_path="c:\\Users\\Aniket\\Downloads\\Presenza-AI\\.env")

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
            print("=== ORG 15 USERS ===")
            res = await db.execute(text("SELECT user_id, email, full_name, role_id, status FROM users WHERE org_id = 15"))
            for row in res.fetchall():
                print(f"User ID: {row[0]} | Email: {row[1]} | Name: {row[2]} | Role: {row[3]} | Status: {row[4]}")
                
            print("\n=== ORG 15 SUBJECT REQUESTS ===")
            res = await db.execute(text("SELECT request_id, teacher_id, subject_name, status FROM subject_requests WHERE org_id = 15"))
            for row in res.fetchall():
                print(f"Req ID: {row[0]} | Teacher ID: {row[1]} | Subject: '{row[2]}' | Status: {row[3]}")
                
            print("\n=== ORG 15 SESSIONS ===")
            res = await db.execute(text("SELECT session_id, created_by, session_name, is_approved, start_time, end_time FROM sessions WHERE org_id = 15 ORDER BY session_id DESC LIMIT 10"))
            for row in res.fetchall():
                print(f"Session ID: {row[0]} | Creator: {row[1]} | Name: '{row[2]}' | Approved: {row[3]} | Start: {row[4]} | End: {row[5]}")

        except Exception as e:
            print("Error:", e)
            
if __name__ == "__main__":
    asyncio.run(main())
