from pydantic import BaseModel
from datetime import datetime

class SessionCreate(BaseModel):
    session_name: str
    start_time: datetime
    end_time: datetime
    location: str | None = None
    camera_id: int | None = None

class SessionResponse(BaseModel):
    session_id: int
    session_name: str
    start_time: datetime
    end_time: datetime
    location: str | None

    class Config:
        from_attributes = True
