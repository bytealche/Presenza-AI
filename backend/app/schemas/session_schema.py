from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SessionCreate(BaseModel):
    session_name: str
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    camera_id: Optional[int] = None
    class_type: Optional[str] = "online"

class SessionUpdate(BaseModel):
    session_name: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    camera_id: Optional[int] = None
    class_type: Optional[str] = None

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
    is_approved: Optional[bool] = False

    class Config:
        from_attributes = True


class ClassNotificationRequest(BaseModel):
    subject: str
    message: str


class SubjectRequest(BaseModel):
    subject_name: str
    description: Optional[str] = None

