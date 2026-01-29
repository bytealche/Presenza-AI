from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.attendance import AttendanceRecord as Attendance
from app.models.enrollment import Enrollment
from app.models.session import Session as SessionModel

def record_attendance(
    db: Session,
    session_id: int,
    user_id: int,
    final_status: str,
    final_score: float | None
):
    # 1️⃣ Validate session
    session = db.query(SessionModel).filter(
        SessionModel.session_id == session_id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    now = datetime.utcnow()
    if not (session.start_time <= now <= session.end_time):
        raise HTTPException(400, "Session not active")

    # 2️⃣ Validate enrollment
    enrolled = db.query(Enrollment).filter(
        Enrollment.session_id == session_id,
        Enrollment.user_id == user_id
    ).first()
    if not enrolled:
        raise HTTPException(403, "User not enrolled")

    # 3️⃣ Prevent duplicates
    existing = db.query(Attendance).filter(
        Attendance.session_id == session_id,
        Attendance.user_id == user_id
    ).first()
    if existing:
        return existing  # idempotent

    # 4️⃣ Save attendance
    attendance = Attendance(
        session_id=session_id,
        user_id=user_id,
        final_status=final_status,
        final_score=final_score,
        decision_time=datetime.utcnow()
    )

    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    return attendance
