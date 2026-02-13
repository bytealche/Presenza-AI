from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey
from datetime import datetime
from app.database.base import Base

class AIDecisionLog(Base):
    __tablename__ = "ai_decision_logs"

    decision_id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("attendance_records.attendance_id"))

    model_name = Column(String(100))
    confidence_score = Column(Float)
    decision_reason = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
