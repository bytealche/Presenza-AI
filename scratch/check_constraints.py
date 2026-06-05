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
            # 1. Print sessions table column names, types and nullable status
            print("--- Columns in 'sessions' table ---")
            columns_res = await db.execute(text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = 'sessions' AND table_schema = 'public'
            """))
            for col in columns_res.fetchall():
                print(f"Column: {col[0]} | Type: {col[1]} | Nullable: {col[2]}")

            # 2. Check check constraints on the table
            print("\n--- Check Constraints on 'sessions' table ---")
            constraints_res = await db.execute(text("""
                SELECT conname, pg_get_constraintdef(oid)
                FROM pg_constraint
                WHERE conrelid = 'public.sessions'::regclass
            """))
            for row in constraints_res.fetchall():
                print(f"Constraint: {row[0]} | Definition: {row[1]}")

        except Exception as e:
            print("Error:", e)
            
if __name__ == "__main__":
    asyncio.run(main())
