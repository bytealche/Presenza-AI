
from app.database.database import engine
from sqlalchemy import inspect

def check_tables():
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print("Tables:", tables)
    if "verification_codes" in tables:
        print("verification_codes table EXISTS.")
    else:
        print("verification_codes table MISSING.")

if __name__ == "__main__":
    check_tables()
