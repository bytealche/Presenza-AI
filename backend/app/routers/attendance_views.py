from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
async def student_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Attendance, SessionModel.session_name)
        .join(SessionModel, Attendance.session_id == SessionModel.session_id)
        .where(Attendance.user_id == current_user.user_id)
    )
    rows = result.all()
    return [
        AttendanceView(
            session_id=att.session_id,
            user_id=att.user_id,
            final_status=att.final_status,
            final_score=att.final_score,
            decision_time=att.decision_time,
            session_name=sname,
            org_id=att.org_id
        )
        for att, sname in rows
    ]

@router.get(
    "/teacher",
    response_model=list[AttendanceView],
    dependencies=[Depends(require_roles([2]))]  # teacher
)
async def teacher_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Attendance, SessionModel.session_name)
        .join(SessionModel, Attendance.session_id == SessionModel.session_id)
        .where(SessionModel.created_by == current_user.user_id)
    )
    rows = result.all()
    return [
        AttendanceView(
            session_id=att.session_id,
            user_id=att.user_id,
            final_status=att.final_status,
            final_score=att.final_score,
            decision_time=att.decision_time,
            session_name=sname,
            org_id=att.org_id
        )
        for att, sname in rows
    ]

@router.get(
    "/admin",
    response_model=list[AttendanceView],
    dependencies=[Depends(require_roles([1]))]  # admin
)
async def admin_attendance(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Attendance, SessionModel.session_name)
        .join(SessionModel, Attendance.session_id == SessionModel.session_id)
        .where(SessionModel.org_id == current_user.org_id)
    )
    rows = result.all()
    return [
        AttendanceView(
            session_id=att.session_id,
            user_id=att.user_id,
            final_status=att.final_status,
            final_score=att.final_score,
            decision_time=att.decision_time,
            session_name=sname,
            org_id=att.org_id
        )
        for att, sname in rows
    ]
