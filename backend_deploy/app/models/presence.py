from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from app.database.base import Base

class PresenceLog(Base):
    __tablename__ = "presence_logs"

    presence_id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("attendance_records.attendance_id"))

    entry_time = Column(DateTime)
    exit_time = Column(DateTime)
    duration_minutes = Column(Float)
    presence_score = Column(Float)
