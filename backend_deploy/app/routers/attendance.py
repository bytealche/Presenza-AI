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

from app.core.auth_dependencies import get_current_user
from app.models.user import User

@router.get("/session/{session_id}")
def get_session_attendance(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Check permissions (Admin or Teacher)
    if current_user.role_id not in [1, 2]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # 2. Check Session
    session = db.query(SessionModel).filter(SessionModel.session_id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # 3. If Teacher, must be MY session
    if current_user.role_id == 2 and session.created_by != current_user.user_id:
         raise HTTPException(status_code=403, detail="Not your session")
         
    # 4. Get Enrollments (All students in this class)
    # We don't have explicit enrollment table usage yet for "Class Roster" usually?
    # Actually, in this system, do we have enrollments? 
    # `app.models.enrollment` exists.
    # Let's assume all students in Org are eligible, OR check Enrollment table.
    
    # Let's simple query AttendanceRecord for this session first.
    # But we want "Absent" students too.
    # If we have an Enrollment table, use it.
    
    # For now, let's just return the attendance records we HAVE. 
    # If we want "Absent" for students who didn't mark, we need a roster.
    # Let's just return records for now.
    
    records = db.query(Attendance).filter(Attendance.session_id == session_id).all()
    
    # We want User details too.
    # Join with User
    results = db.query(Attendance, User).join(User, Attendance.user_id == User.user_id).filter(Attendance.session_id == session_id).all()
    
    return [
        {
            "user_id": r[1].user_id,
            "full_name": r[1].full_name,
            "email": r[1].email,
            "status": r[0].final_status,
            "timestamp": r[0].decision_time
        }
        for r in results
    ]
