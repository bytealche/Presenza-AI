from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os

load_dotenv()

env_db_url = os.getenv("DATABASE_URL")
if not env_db_url:
    env_db_url = "sqlite:///./presenza.db"

# Replace standard URLs with async drivers
if env_db_url.startswith("postgresql://"):
    SQLALCHEMY_DATABASE_URL = env_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif env_db_url.startswith("sqlite:///"):
    SQLALCHEMY_DATABASE_URL = env_db_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
else:
    SQLALCHEMY_DATABASE_URL = env_db_url

connect_args_dict = {}
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args_dict["check_same_thread"] = False
elif "postgresql" in SQLALCHEMY_DATABASE_URL:
    connect_args_dict["prepared_statement_cache_size"] = 0

engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=False,
    connect_args=connect_args_dict
)

SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False
)
