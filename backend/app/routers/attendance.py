from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from app.database.dependencies import get_db
from app.models.attendance import AttendanceRecord as Attendance
from app.models.enrollment import Enrollment
from app.models.session import Session as SessionModel
from app.schemas.attendance_schema import AttendanceMark
from app.core.role_dependencies import require_roles

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)

@router.post(
    "/mark",
    dependencies=[Depends(require_roles([2]))]  # teacher
)
def mark_attendance(
    data: AttendanceMark,
    db: Session = Depends(get_db)
):
    # 1️⃣ Check session exists
    session = db.query(SessionModel).filter(
        SessionModel.session_id == data.session_id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    # 2️⃣ Check session time validity
    now = datetime.utcnow()
    if not (session.start_time <= now <= session.end_time):
        raise HTTPException(400, "Session not active")

    # 3️⃣ Check enrollment
    enrolled = db.query(Enrollment).filter(
        Enrollment.session_id == data.session_id,
        Enrollment.user_id == data.user_id
    ).first()
    if not enrolled:
        raise HTTPException(403, "Student not enrolled")

    # 4️⃣ Prevent duplicate attendance
    existing = db.query(Attendance).filter(
        Attendance.session_id == data.session_id,
        Attendance.user_id == data.user_id
    ).first()
    if existing:
        raise HTTPException(400, "Attendance already marked")

    # 5️⃣ Save attendance
    attendance = Attendance(
        session_id=data.session_id,
        user_id=data.user_id,
        final_status=data.final_status,
        final_score=data.final_score,
        decision_time=datetime.utcnow()
    )

    db.add(attendance)
    db.commit()
    return {"message": "Attendance recorded successfully"}
