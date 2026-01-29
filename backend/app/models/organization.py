from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime
from app.database.base import Base

class Organization(Base):
    __tablename__ = "organizations"

    org_id = Column(Integer, primary_key=True, index=True)
    org_name = Column(String(255), nullable=False)
    org_type = Column(String(50))
    status = Column(String(20), default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
