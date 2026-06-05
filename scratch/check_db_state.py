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
            print("--- Subject Requests ---")
            res = await db.execute(text("SELECT request_id, org_id, teacher_id, subject_name, status FROM subject_requests"))
            rows = res.fetchall()
            if not rows:
                print("No subject requests found.")
            for row in rows:
                print(f"ID: {row[0]} | Org: {row[1]} | Teacher: {row[2]} | Subject: '{row[3]}' | Status: {row[4]}")
                
            print("\n--- Sessions ---")
            res = await db.execute(text("SELECT session_id, org_id, created_by, session_name, is_approved FROM sessions LIMIT 10"))
            rows = res.fetchall()
            if not rows:
                print("No sessions found.")
            for row in rows:
                print(f"ID: {row[0]} | Org: {row[1]} | Creator: {row[2]} | Session: '{row[3]}' | Approved: {row[4]}")
                
            print("\n--- Users ---")
            res = await db.execute(text("SELECT user_id, org_id, email, full_name, role_id, status FROM users LIMIT 10"))
            rows = res.fetchall()
            for row in rows:
                print(f"ID: {row[0]} | Org: {row[1]} | Email: {row[2]} | Name: {row[3]} | Role: {row[4]} | Status: {row[5]}")

        except Exception as e:
            print("Error:", e)
            
if __name__ == "__main__":
    asyncio.run(main())
