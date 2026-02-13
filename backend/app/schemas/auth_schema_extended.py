from pydantic import BaseModel, EmailStr, constr, Field
from typing import Optional

class OTPRequest(BaseModel):
    email: EmailStr

class OrganizationRegisterRequest(BaseModel):
    org_name: str
    email: EmailStr
    password: constr(min_length=8, max_length=64)
    otp: str

class UserRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: constr(min_length=8, max_length=64)
    otp: str
    role_id: int
    org_id: Optional[int] = None
