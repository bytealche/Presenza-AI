from sqlalchemy.ext.asyncio import AsyncSession
from app.ai_engine.vector_store import find_match

async def recognize_face(db: AsyncSession, embedding, org_id: int = None):
    user_id, confidence = await find_match(db, embedding, org_id=org_id)
    return user_id, confidence
