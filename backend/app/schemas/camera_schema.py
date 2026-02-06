from pydantic import BaseModel
from typing import Optional

class CameraCreate(BaseModel):
    org_id: int
    camera_type: str = "ip" # ip, browser, mobile
    location: str
    connection_url: Optional[str] = None
    description: Optional[str] = None

class CameraResponse(BaseModel):
    camera_id: int
    org_id: int
    camera_type: str
    location: str
    connection_url: Optional[str]
    description: Optional[str]
    status: str

    class Config:
        from_attributes = True
