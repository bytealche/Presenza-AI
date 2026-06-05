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
            res = await db.execute(text("SELECT teacher_id, status FROM subject_requests LIMIT 1"))
            row = res.fetchone()
            if row:
                print("Row object type:", type(row))
                try:
                    print("Status (attribute):", row.status)
                    print("Teacher ID (attribute):", row.teacher_id)
                    print("Attribute access works!")
                except AttributeError as e:
                    print("Attribute access failed:", e)
                try:
                    print("Status (mapping):", row._mapping['status'])
                    print("Teacher ID (mapping):", row._mapping['teacher_id'])
                    print("Mapping access works!")
                except Exception as e:
                    print("Mapping access failed:", e)
            else:
                print("No rows found to test.")
        except Exception as e:
            print("DB Error:", e)
            
if __name__ == "__main__":
    asyncio.run(main())
