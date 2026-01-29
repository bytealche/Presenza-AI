from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime
from app.database.base import Base

class Enrollment(Base):
    __tablename__ = "enrollments"
    enrollment_id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"))
    user_id = Column(Integer, ForeignKey("users.user_id"))
    enrolled_at = Column(DateTime)
