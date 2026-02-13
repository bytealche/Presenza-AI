from sqlalchemy import Column, Integer, Float, ForeignKey
from app.database.base import Base

class EnvironmentMetric(Base):
    __tablename__ = "environment_metrics"

    env_id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"))

    lighting_score = Column(Float)
    blur_score = Column(Float)
    noise_level = Column(Float)
