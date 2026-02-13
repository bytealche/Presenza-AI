from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from datetime import datetime
from app.database.base import Base

class FaceProfile(Base):
    __tablename__ = "face_profiles"

    face_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), unique=True)

    embedding_ref = Column(String, nullable=False)  # Vector DB reference
    avg_match_score = Column(Float)
    registered_at = Column(DateTime, default=datetime.utcnow)
