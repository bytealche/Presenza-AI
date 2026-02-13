from sqlalchemy import Column, Integer, Float, String, ForeignKey
from app.database.base import Base

class EngagementMetric(Base):
    __tablename__ = "engagement_metrics"

    engagement_id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("attendance_records.attendance_id"))

    attention_score = Column(Float)
    head_pose_score = Column(Float)
    eye_gaze_score = Column(Float)
    engagement_level = Column(String(20))  # high / medium / low
