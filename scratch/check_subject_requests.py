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
            # Check if table exists
            res = await db.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'subject_requests'
                );
            """))
            exists = res.scalar()
            print(f"Table 'subject_requests' exists: {exists}")
            
            if exists:
                # Query columns
                res_col = await db.execute(text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'subject_requests'"))
                print("Columns:")
                for row in res_col.fetchall():
                    print(f"  {row[0]} ({row[1]})")
        except Exception as e:
            print("Error checking subject_requests table:", e)
            
if __name__ == "__main__":
    asyncio.run(main())
