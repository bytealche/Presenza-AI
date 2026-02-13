
from app.database.dependencies import engine
from app.model.verification_code import VerificationCode
from app.database.database import Base

def create_tables():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

if __name__ == "__main__":
    create_tables()
