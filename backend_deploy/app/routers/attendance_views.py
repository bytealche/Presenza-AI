from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.attendance import AttendanceRecord as Attendance
from app.models.session import Session as SessionModel
from app.models.user import User
from app.schemas.attendance_view_schema import AttendanceView
from app.core.role_dependencies import require_roles
from app.core.auth_dependencies import get_current_user

router = APIRouter(
    prefix="/attendance/view",
    tags=["Attendance Views"]
)
@router.get(
    "/student",
    response_model=list[AttendanceView],
    dependencies=[Depends(require_roles([3]))]  # student
)
def student_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Attendance)
        .filter(Attendance.user_id == current_user.user_id)
        .all()
    )
@router.get(
    "/teacher",
    response_model=list[AttendanceView],
    dependencies=[Depends(require_roles([2]))]  # teacher
)
def teacher_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Attendance)
        .join(SessionModel, Attendance.session_id == SessionModel.session_id)
        .filter(SessionModel.created_by == current_user.user_id)
        .all()
    )
@router.get(
    "/admin",
    response_model=list[AttendanceView],
    dependencies=[Depends(require_roles([1]))]  # admin
)
def admin_attendance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Attendance)
        .join(SessionModel, Attendance.session_id == SessionModel.session_id)
        .filter(SessionModel.org_id == current_user.org_id)
        .all()
    )
