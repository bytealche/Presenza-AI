from sqlalchemy.ext.asyncio import AsyncSession
from app.ai_engine.vector_store import find_match

async def recognize_face(db: AsyncSession, embedding):
    user_id, confidence = await find_match(db, embedding)
    return user_id, confidence
