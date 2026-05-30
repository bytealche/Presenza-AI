from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class OTPRequest(BaseModel):
    email: EmailStr
    check_exists: Optional[bool] = False

class OrganizationRegisterRequest(BaseModel):
    org_name: str
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=64)
    otp: str

class UserRegisterRequest(BaseModel):
    full_name: str
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=64)
    otp: str
    role_id: int
    org_id: Optional[int] = None

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=8, max_length=64)
    org_id: Optional[int] = None

class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


