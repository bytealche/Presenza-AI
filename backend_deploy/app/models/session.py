from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database.base import Base

class Session(Base):
    __tablename__ = "sessions"

    session_id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.org_id"), index=True)
    created_by = Column(Integer, ForeignKey("users.user_id"), index=True)
    camera_id = Column(Integer, ForeignKey("camera_devices.camera_id"))

    session_name = Column(String(255), nullable=False)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    location = Column(String(255))

    created_at = Column(DateTime, default=datetime.utcnow)

    creator = relationship("User")
    camera = relationship("CameraDevice")
