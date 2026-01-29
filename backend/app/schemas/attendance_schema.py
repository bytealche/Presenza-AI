from pydantic import BaseModel

class AttendanceMark(BaseModel):
    session_id: int
    user_id: int
    final_status: str   # present / absent / fraud
    final_score: float | None = None
