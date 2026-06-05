import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

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
            print("--- Latest 20 System Logs ---")
            res = await db.execute(text("""
                SELECT log_id, action, user_id, ip_address, timestamp
                FROM system_logs
                ORDER BY timestamp DESC
                LIMIT 20
            """))
            for row in res.fetchall():
                print(f"Log ID: {row[0]} | Action: {row[1]} | User: {row[2]} | IP: {row[3]} | Timestamp: {row[4]}")
        except Exception as e:
            print("Error:", e)
            
if __name__ == "__main__":
    asyncio.run(main())
