from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class SessionCreate(BaseModel):
    session_name: str
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    camera_id: Optional[int] = None

class SessionResponse(BaseModel):
    session_id: int
    org_id: Optional[int] = None
    session_name: str
    start_time: datetime
    end_time: datetime
    location: Optional[str] = None
    camera_id: Optional[int] = None
    created_by: Optional[int] = None

    class Config:
        from_attributes = True
