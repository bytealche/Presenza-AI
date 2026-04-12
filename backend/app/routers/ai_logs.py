from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from app.database.database import get_db
from app.models.ai_decision import AIDecisionLog
from app.models.attendance import AttendanceRecord
from app.models.user import User
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/ai-logs", tags=["AI Logs"])

class AILogResponse(BaseModel):
    decision_id: int
    attendance_id: int
    user_name: str
    model_name: str
    confidence_score: float
    decision_reason: str
    created_at: datetime
    final_status: str

    class Config:
        from_attributes = True

@router.get("", response_model=List[AILogResponse])
async def get_ai_logs(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(AIDecisionLog, User.full_name, AttendanceRecord.final_status)
        .join(AttendanceRecord, AIDecisionLog.attendance_id == AttendanceRecord.attendance_id)
        .join(User, AttendanceRecord.user_id == User.user_id)
        .order_by(AIDecisionLog.created_at.desc())
        .limit(100)
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    response = []
    for log, user_name, final_status in rows:
        response.append({
            "decision_id": log.decision_id,
            "attendance_id": log.attendance_id,
            "user_name": user_name,
            "model_name": log.model_name,
            "confidence_score": log.confidence_score,
            "decision_reason": log.decision_reason,
            "created_at": log.created_at,
            "final_status": final_status
        })
    return response
