from pydantic import BaseModel, EmailStr
from typing import Optional

class OTPRequest(BaseModel):
    email: EmailStr

class OrganizationRegisterRequest(BaseModel):
    org_name: str
    email: EmailStr
    password: str
    otp: str

class UserRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    otp: str
    role_id: int
    org_id: Optional[int] = None
