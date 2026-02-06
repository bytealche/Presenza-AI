from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

# Fallback to SQLite if no DATABASE_URL is set or if it's empty
env_db_url = os.getenv("DATABASE_URL")
SQLALCHEMY_DATABASE_URL = env_db_url if env_db_url else "sqlite:///./presenza.db"


engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in SQLALCHEMY_DATABASE_URL else {}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
