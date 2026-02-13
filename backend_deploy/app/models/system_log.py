from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from datetime import datetime
from app.database.base import Base

class SystemLog(Base):
    __tablename__ = "system_logs"

    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))

    action = Column(String)
    ip_address = Column(String(50))
    timestamp = Column(DateTime, default=datetime.utcnow)
