from sqlalchemy import Column, Integer, Float, String, Boolean, ForeignKey
from app.database.base import Base

class FraudAnalysis(Base):
    __tablename__ = "fraud_analysis"

    fraud_id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("attendance_records.attendance_id"))

    fraud_score = Column(Float)  # 0 to 1
    fraud_reason = Column(String)
    flagged = Column(Boolean, default=False)
