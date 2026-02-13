from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime

from app.database.dependencies import get_db
from app.models.user import User
from app.models.session import Session as SessionModel
from app.models.attendance import AttendanceRecord
from app.models.enrollment import Enrollment
from app.core.role_dependencies import require_roles
from app.core.auth_dependencies import get_current_user

router = APIRouter(
    prefix="/analytics",
    tags=["Analytics"]
)

@router.get("/admin/stats", dependencies=[Depends(require_roles([1]))])
def get_admin_stats(db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    today = datetime.utcnow()
    # Active sessions: start_time <= now <= end_time OR just end_time > now?
    # Let's say active if incomplete (end_time > now)
    active_sessions = db.query(SessionModel).filter(SessionModel.end_time > today).count()
    
    # Calculate overall attendance rate
    # Real logic: (Total Present / Total Expected) * 100
    total_records = db.query(AttendanceRecord).count()
    total_present = db.query(AttendanceRecord).filter(AttendanceRecord.final_status == "Present").count()
    attendance_rate = (total_present / total_records * 100) if total_records > 0 else 0

    return {
        "total_users": total_users,
        "active_sessions": active_sessions,
        "attendance_rate": round(attendance_rate, 1),
        "fraud_alerts": 0 # Placeholder for now
    }

@router.get("/teacher/stats", dependencies=[Depends(require_roles([2]))])
def get_teacher_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Classes created by this teacher
    my_classes_count = db.query(SessionModel).filter(SessionModel.created_by == current_user.user_id).count()
    
    # Attendance for my sessions
    # Join Session to filter by teacher
    my_sessions = db.query(SessionModel).filter(SessionModel.created_by == current_user.user_id).all()
    session_ids = [s.session_id for s in my_sessions]
    
    total_present = 0
    total_records = 0
    
    if session_ids:
        total_records = db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(session_ids)).count()
        total_present = db.query(AttendanceRecord).filter(AttendanceRecord.session_id.in_(session_ids), AttendanceRecord.final_status == "Present").count()
    
    attendance_rate = (total_present / total_records * 100) if total_records > 0 else 0

    return {
        "total_classes": my_classes_count,
        "avg_attendance": round(attendance_rate, 1),
        "low_engagement": 0
    }

@router.get("/student/stats", dependencies=[Depends(require_roles([3]))])
def get_student_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # My attendance
    my_records = db.query(AttendanceRecord).filter(AttendanceRecord.user_id == current_user.user_id).all()
    total = len(my_records)
    present = sum(1 for r in my_records if r.final_status == "Present")
    absent = sum(1 for r in my_records if r.final_status == "Absent") # Assuming 'Absent' records exist
    
    rate = (present / total * 100) if total > 0 else 0
    
    return {
        "attendance_rate": round(rate, 1),
        "classes_missed": absent,
        # Return recent history too?
        "recent_history": [
            {
                "id": r.attendance_id,
                "date": str(r.decision_time.date()),
                "status": r.final_status,
                "time": str(r.decision_time.time())
            } for r in my_records[-5:] # Last 5
        ]
    }
