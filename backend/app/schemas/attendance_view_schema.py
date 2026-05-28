from pydantic import BaseModel
from datetime import datetime

class AttendanceView(BaseModel):
    session_id: int
    user_id: int
    final_status: str
    final_score: float | None
    decision_time: datetime
    session_name: str | None = None
    org_id: int | None = None

    class Config:
        from_attributes = True
