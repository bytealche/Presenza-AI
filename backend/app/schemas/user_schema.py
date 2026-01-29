from pydantic import BaseModel , constr

class UserCreate(BaseModel):
    full_name: str
    email: str
    password: constr(min_length=8 , max_length=64)
    org_id: int
    role_id: int

class UserResponse(BaseModel):
    user_id: int
    full_name: str
    email: str
    status: str
    org_id: int
    role_id: int

    class Config:
        orm_mode = True
