import os
import sys
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Ensure we are in backend dir
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

load_dotenv()

def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL is not set.")
        return

    if db_url.startswith("postgresql+asyncpg://"):
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    print("Connecting to database...")
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("Executing ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE; ...")
        try:
            conn.execute(text("ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE;"))
            conn.commit()
            print("Successfully added 'is_approved' column to 'sessions' table!")
        except Exception as e:
            print(f"FAILED to add column: {e}")

if __name__ == "__main__":
    main()
