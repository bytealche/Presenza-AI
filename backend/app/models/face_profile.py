from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, String
from pgvector.sqlalchemy import Vector
from datetime import datetime
from app.database.base import Base

class FaceProfile(Base):
    __tablename__ = "face_profiles"

    face_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), unique=True)

    embedding = Column(Vector(512), nullable=False)
    image_url = Column(String(255), nullable=True) # Public URL from Supabase Storage
    avg_match_score = Column(Float)
    registered_at = Column(DateTime, default=datetime.utcnow)
