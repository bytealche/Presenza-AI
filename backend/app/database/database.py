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
    connect_args_dict["statement_cache_size"] = 0
    connect_args_dict["prepared_statement_cache_size"] = 0

engine_args = {
    "echo": False,
    "connect_args": connect_args_dict,
}

# Configure robust connection pooling for PostgreSQL (Supabase)
if "sqlite" not in SQLALCHEMY_DATABASE_URL:
    engine_args["pool_size"] = 15
    engine_args["max_overflow"] = 25
    engine_args["pool_recycle"] = 300
    engine_args["pool_pre_ping"] = True

engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    **engine_args
)

SessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False
)
