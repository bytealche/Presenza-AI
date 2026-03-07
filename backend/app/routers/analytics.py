from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from datetime import datetime
import logging

from app.database.dependencies import get_db
from app.models.user import User
from app.models.session import Session as SessionModel
from app.models.attendance import AttendanceRecord
from app.core.role_dependencies import require_roles
from app.core.auth_dependencies import get_current_user
from app.services.fraud_service import get_total_fraud_alerts, get_fraud_alert_count
from app.services.engagement_service import get_org_low_engagement_count

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/admin/stats", dependencies=[Depends(require_roles([1]))])
async def get_admin_stats(db: AsyncSession = Depends(get_db)):
    total_users = await db.scalar(select(func.count(User.user_id))) or 0
    now = datetime.utcnow()
    active_sessions = (
        await db.scalar(
            select(func.count(SessionModel.session_id)).where(SessionModel.end_time > now)
        )
        or 0
    )

    total_records = await db.scalar(select(func.count(AttendanceRecord.attendance_id))) or 0
    total_present = (
        await db.scalar(
            select(func.count(AttendanceRecord.attendance_id)).where(
                AttendanceRecord.final_status == "Present"
            )
        )
        or 0
    )
    attendance_rate = (total_present / total_records * 100) if total_records > 0 else 0.0

    fraud_alerts = await get_total_fraud_alerts(db)

    return {
        "total_users": total_users,
        "active_sessions": active_sessions,
        "attendance_rate": round(attendance_rate, 1),
        "fraud_alerts": fraud_alerts,
    }


@router.get("/teacher/stats", dependencies=[Depends(require_roles([2]))])
async def get_teacher_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    my_classes_count = (
        await db.scalar(
            select(func.count(SessionModel.session_id)).where(
                SessionModel.created_by == current_user.user_id
            )
        )
        or 0
    )

    result = await db.execute(
        select(SessionModel).where(SessionModel.created_by == current_user.user_id)
    )
    my_sessions = result.scalars().all()
    session_ids = [s.session_id for s in my_sessions]

    total_records = 0
    total_present = 0
    low_engagement = 0

    if session_ids:
        total_records = (
            await db.scalar(
                select(func.count(AttendanceRecord.attendance_id)).where(
                    AttendanceRecord.session_id.in_(session_ids)
                )
            )
            or 0
        )
        total_present = (
            await db.scalar(
                select(func.count(AttendanceRecord.attendance_id)).where(
                    AttendanceRecord.session_id.in_(session_ids),
                    AttendanceRecord.final_status == "Present",
                )
            )
            or 0
        )
        low_engagement = await get_org_low_engagement_count(session_ids, db)

    attendance_rate = (total_present / total_records * 100) if total_records > 0 else 0.0

    return {
        "total_classes": my_classes_count,
        "avg_attendance": round(attendance_rate, 1),
        "low_engagement": low_engagement,
    }


@router.get("/student/stats", dependencies=[Depends(require_roles([3]))])
async def get_student_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(AttendanceRecord)
        .where(AttendanceRecord.user_id == current_user.user_id)
        .order_by(AttendanceRecord.decision_time.desc())
    )
    my_records = result.scalars().all()

    total = len(my_records)
    present = sum(1 for r in my_records if r.final_status == "Present")
    absent = sum(1 for r in my_records if r.final_status == "Absent")
    rate = (present / total * 100) if total > 0 else 0.0

    return {
        "attendance_rate": round(rate, 1),
        "classes_attended": present,
        "classes_missed": absent,
        "recent_history": [
            {
                "id": r.attendance_id,
                "date": r.decision_time.date().isoformat() if r.decision_time else None,
                "status": r.final_status,
                "time": r.decision_time.time().isoformat() if r.decision_time else None,
            }
            for r in my_records[:5]
        ],
    }
