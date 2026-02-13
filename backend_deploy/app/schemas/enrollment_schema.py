from pydantic import BaseModel

class EnrollmentCreate(BaseModel):
    session_id: int
    user_id: int  # student_id

class EnrollmentResponse(BaseModel):
    enrollment_id: int
    session_id: int
    user_id: int

    class Config:
        from_attributes = True
