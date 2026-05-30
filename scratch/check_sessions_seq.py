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
            # Check maximum session_id in public.sessions
            res = await db.execute(text("SELECT MAX(session_id), COUNT(*) FROM public.sessions"))
            max_id, count = res.fetchone()
            print(f"Max session_id in public.sessions: {max_id}, Total count: {count}")
            
            # Print all existing sessions
            res = await db.execute(text("SELECT session_id, session_name, camera_id FROM public.sessions"))
            print("Existing sessions:")
            for row in res.fetchall():
                print(f"ID: {row[0]} | Name: {row[1]} | Camera: {row[2]}")
                
            # Check the sequence for public.sessions session_id
            # First, find the sequence name
            seq_res = await db.execute(text("""
                SELECT pg_get_serial_sequence('public.sessions', 'session_id')
            """))
            seq_name = seq_res.scalar()
            print(f"Sequence name: {seq_name}")
            
            if seq_name:
                currval_res = await db.execute(text(f"SELECT pg_sequence_last_value('{seq_name}')"))
                last_val = currval_res.scalar()
                print(f"Sequence last value: {last_val}")
                
        except Exception as e:
            print("Error querying database:", e)
            
if __name__ == "__main__":
    asyncio.run(main())
