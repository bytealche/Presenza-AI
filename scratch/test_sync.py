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
            # Query all sequence relationships
            query = """
                SELECT
                    t.relname AS table_name,
                    a.attname AS column_name,
                    s.relname AS sequence_name
                FROM pg_class s
                JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass
                JOIN pg_class t ON t.oid = d.refobjid
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
                WHERE s.relkind = 'S' AND t.relnamespace = 'public'::regnamespace;
            """
            res = await db.execute(text(query))
            rows = res.fetchall()
            
            print("Found sequences in 'public' schema:")
            for row in rows:
                table, col, seq = row
                print(f"Table: {table} | Column: {col} | Sequence: {seq}")
                
                # Fetch max value of the column
                max_res = await db.execute(text(f"SELECT COALESCE(MAX({col}), 0) FROM public.{table}"))
                max_val = max_res.scalar()
                print(f"  Max value: {max_val}")
                
                # Reset/sync sequence using setval
                # We set it to the max_val, but wait - if max_val is 0, we can set it to 1 and is_called = false
                # This ensures the first nextval generates 1.
                if max_val > 0:
                    sync_query = f"SELECT setval('public.{seq}', {max_val}, true)"
                else:
                    sync_query = f"SELECT setval('public.{seq}', 1, false)"
                    
                await db.execute(text(sync_query))
                print(f"  Synchronized public.{seq} successfully!")
                
            await db.commit()
            print("All sequences synchronized successfully in test!")
            
        except Exception as e:
            print("Error running sync test:", e)
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(main())
