import os
import sys
from sqlalchemy import create_engine, MetaData, Table, select, insert, text
from dotenv import load_dotenv

# Load standard .env file if present
load_dotenv()

def main():
    print("=========================================")
    print("      Presenza-AI Database Migrator      ")
    print("=========================================\n")

    # Set URLs: Can be specified as environment variables or direct variables
    old_url = os.getenv("OLD_DATABASE_URL")
    new_url = os.getenv("NEW_DATABASE_URL")

    if not old_url:
        print("OLD_DATABASE_URL is not set.")
        old_url = input("Enter your OLD database connection string (from your old backend/.env):\n> ").strip()
    
    if not new_url:
        print("\nNEW_DATABASE_URL is not set.")
        new_url = input("Enter your NEW database connection string (from your new region project):\n> ").strip()

    if not old_url or not new_url:
        print("Error: Both database URLs are required.")
        sys.exit(1)

    # Ensure synchronous postgres protocol is used (Alembic and raw scripts use standard postgresql://)
    # Clean up standard asyncpg prefixes if pasted in
    if old_url.startswith("postgresql+asyncpg://"):
        old_url = old_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    if new_url.startswith("postgresql+asyncpg://"):
        new_url = new_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    print("\nConnecting to databases...")
    try:
        old_engine = create_engine(old_url)
        new_engine = create_engine(new_url)
    except Exception as e:
        print(f"Error creating connection engines: {e}")
        sys.exit(1)

    # Reflect tables
    print("Reflecting tables from old database...")
    try:
        old_meta = MetaData()
        old_meta.reflect(bind=old_engine)
    except Exception as e:
        print(f"Failed to connect/reflect old database: {e}")
        sys.exit(1)

    print("Reflecting tables from new database...")
    try:
        new_meta = MetaData()
        new_meta.reflect(bind=new_engine)
    except Exception as e:
        print(f"Failed to connect/reflect new database: {e}")
        sys.exit(1)

    # Logical list of tables to migrate in recommended order
    tables_to_migrate = [
        "organizations",
        "roles",
        "users",
        "camera_devices",
        "sessions",
        "enrollments",
        "face_profiles",
        "attendance_records",
        "adaptive_thresholds",
        "ai_decisions",
        "engagement_records",
        "fraud_logs",
        "verification_codes",
        "system_logs",
        "environments"
    ]

    print("\nStarting migration...")
    
    with old_engine.connect() as old_conn, new_engine.connect() as new_conn:
        # Begin transaction
        new_trans = new_conn.begin()
        try:
            # Disable constraints check on target database temporarily to allow raw data copy
            print("Bypassing foreign key check triggers on the target database...")
            new_conn.execute(text("SET session_replication_role = 'replica';"))

            for table_name in tables_to_migrate:
                if table_name not in old_meta.tables:
                    print(f"-> Table '{table_name}' does not exist in source database. Skipping.")
                    continue
                if table_name not in new_meta.tables:
                    print(f"-> Table '{table_name}' does not exist in target database (make sure migrations have run!). Skipping.")
                    continue

                old_table = old_meta.tables[table_name]
                new_table = new_meta.tables[table_name]

                # Fetch rows
                rows = old_conn.execute(select(old_table)).fetchall()
                if not rows:
                    print(f"-> Table '{table_name}' has 0 rows. Skipping copy.")
                    continue

                # Clean any existing rows in the target table to avoid unique key / PK conflicts
                new_conn.execute(new_table.delete())

                # Format rows as dicts for insert
                insert_data = [row._mapping for row in rows]

                print(f"-> Copying {len(insert_data)} rows into '{table_name}'...")
                new_conn.execute(insert(new_table), insert_data)

            # Restore triggers
            print("Re-enabling constraints check triggers...")
            new_conn.execute(text("SET session_replication_role = 'origin';"))

            # Commit changes
            new_trans.commit()
            print("\nSUCCESS: All table records migrated successfully!")

        except Exception as e:
            new_trans.rollback()
            print(f"\nFATAL: Migration failed and rolled back due to error:\n{e}")
            sys.exit(1)

if __name__ == "__main__":
    main()
