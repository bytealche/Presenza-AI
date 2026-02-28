from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
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
async def get_admin_stats(db: AsyncSession = Depends(get_db)):
    total_users = await db.scalar(select(func.count(User.user_id))) or 0
    today = datetime.utcnow()
    # Active sessions: start_time <= now <= end_time OR just end_time > now?
    # Let's say active if incomplete (end_time > now)
    active_sessions = await db.scalar(select(func.count(SessionModel.session_id)).where(SessionModel.end_time > today)) or 0
    
    # Calculate overall attendance rate
    # Real logic: (Total Present / Total Expected) * 100
    total_records = await db.scalar(select(func.count(AttendanceRecord.attendance_id))) or 0
    total_present = await db.scalar(select(func.count(AttendanceRecord.attendance_id)).where(AttendanceRecord.final_status == "Present")) or 0
    attendance_rate = (total_present / total_records * 100) if total_records > 0 else 0

    return {
        "total_users": total_users,
        "active_sessions": active_sessions,
        "attendance_rate": round(attendance_rate, 1),
        "fraud_alerts": 0 # Placeholder for now
    }

@router.get("/teacher/stats", dependencies=[Depends(require_roles([2]))])
async def get_teacher_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Classes created by this teacher
    my_classes_count = await db.scalar(select(func.count(SessionModel.session_id)).where(SessionModel.created_by == current_user.user_id)) or 0
    
    # Attendance for my sessions
    # Join Session to filter by teacher
    result = await db.execute(select(SessionModel).where(SessionModel.created_by == current_user.user_id))
    my_sessions = result.scalars().all()
    session_ids = [s.session_id for s in my_sessions]
    
    total_present = 0
    total_records = 0
    
    if session_ids:
        total_records = await db.scalar(select(func.count(AttendanceRecord.attendance_id)).where(AttendanceRecord.session_id.in_(session_ids))) or 0
        total_present = await db.scalar(select(func.count(AttendanceRecord.attendance_id)).where(AttendanceRecord.session_id.in_(session_ids), AttendanceRecord.final_status == "Present")) or 0
    
    attendance_rate = (total_present / total_records * 100) if total_records > 0 else 0

    return {
        "total_classes": my_classes_count,
        "avg_attendance": round(attendance_rate, 1),
        "low_engagement": 0
    }

@router.get("/student/stats", dependencies=[Depends(require_roles([3]))])
async def get_student_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # My attendance
    result = await db.execute(select(AttendanceRecord).where(AttendanceRecord.user_id == current_user.user_id))
    my_records = result.scalars().all()
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
