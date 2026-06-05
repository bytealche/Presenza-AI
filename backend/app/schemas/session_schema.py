from pydantic import BaseModel, field_serializer, field_validator
from datetime import datetime, timezone
from typing import Optional

class SessionCreate(BaseModel):
    session_name: str
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    camera_id: Optional[int] = None
    class_type: Optional[str] = "online"

    @field_validator('start_time', 'end_time')
    @classmethod
    def make_naive(cls, v: datetime) -> datetime:
        if v.tzinfo is not None:
            return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v

class SessionUpdate(BaseModel):
    session_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    camera_id: Optional[int] = None
    class_type: Optional[str] = None

    @field_validator('start_time', 'end_time')
    @classmethod
    def make_naive(cls, v: Optional[datetime]) -> Optional[datetime]:
        if v is not None and v.tzinfo is not None:
            return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v

class SessionResponse(BaseModel):
    session_id: int
    org_id: Optional[int] = None
    session_name: str
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    camera_id: Optional[int] = None
    created_by: Optional[int] = None
    class_type: Optional[str] = "online"
    is_approved: Optional[bool] = True

    class Config:
        from_attributes = True

    @field_serializer('start_time', 'end_time')
    def serialize_dt(self, dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()


class ClassNotificationRequest(BaseModel):
    subject: str
    message: str


class SubjectRequest(BaseModel):
    subject_name: str
    description: Optional[str] = None

