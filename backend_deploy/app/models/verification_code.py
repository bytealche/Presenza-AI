from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timedelta
from app.database.base import Base

class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), index=True, nullable=False)
    code = Column(String(6), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def is_valid(self):
        return datetime.utcnow() < self.expires_at
