from sqlalchemy.ext.asyncio import AsyncSession
from app.database.database import SessionLocal
from typing import AsyncGenerator

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as db:
        yield db
