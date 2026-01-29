from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime
from app.database.base import Base

class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    attendance_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    session_id = Column(Integer, ForeignKey("sessions.session_id"))

    final_status = Column(String(20))   # present / absent / flagged
    final_score = Column(Float)
    decision_time = Column(DateTime, default=datetime.utcnow)
