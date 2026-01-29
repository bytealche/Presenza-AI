from sqlalchemy import Column, Integer, String, ForeignKey
from app.database.base import Base

class CameraDevice(Base):
    __tablename__ = "camera_devices"

    camera_id = Column(Integer, primary_key=True, index=True)
    org_id = Column(Integer, ForeignKey("organizations.org_id"))

    camera_type = Column(String(50))   # browser / ip / external
    location = Column(String(255))
    status = Column(String(20), default="active")
