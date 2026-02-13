from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey
from datetime import datetime
from app.database.base import Base

class AdaptiveThreshold(Base):
    __tablename__ = "adaptive_thresholds"

    threshold_id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"))

    face_threshold = Column(Float)
    liveness_threshold = Column(Float)
    engagement_threshold = Column(Float)
    updated_at = Column(DateTime, default=datetime.utcnow)
