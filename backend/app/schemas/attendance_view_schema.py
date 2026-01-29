from pydantic import BaseModel
from datetime import datetime

class AttendanceView(BaseModel):
    session_id: int
    user_id: int
    final_status: str
    final_score: float | None
    decision_time: datetime

    class Config:
        from_attributes = True
