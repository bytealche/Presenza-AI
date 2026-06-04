from pydantic import BaseModel, field_serializer
from datetime import datetime, timezone

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

    @field_serializer('decision_time')
    def serialize_dt(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()
