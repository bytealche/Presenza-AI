from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select
from datetime import datetime, timezone
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
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    total_users = await db.scalar(
        select(func.count(User.user_id)).where(User.org_id == current_user.org_id)
    ) or 0
    now = datetime.utcnow()
    active_sessions = (
        await db.scalar(
            select(func.count(SessionModel.session_id)).where(
                SessionModel.org_id == current_user.org_id,
                SessionModel.end_time > now
            )
        )
        or 0
    )

    total_records = await db.scalar(
        select(func.count(AttendanceRecord.attendance_id))
        .join(SessionModel, AttendanceRecord.session_id == SessionModel.session_id)
        .where(SessionModel.org_id == current_user.org_id)
    ) or 0
    
    total_present = (
        await db.scalar(
            select(func.count(AttendanceRecord.attendance_id))
            .join(SessionModel, AttendanceRecord.session_id == SessionModel.session_id)
            .where(
                SessionModel.org_id == current_user.org_id,
                AttendanceRecord.final_status == "Present"
            )
        )
        or 0
    )
    attendance_rate = (total_present / total_records * 100) if total_records > 0 else 0.0

    fraud_alerts = await get_total_fraud_alerts(db, org_id=current_user.org_id)

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
                "timestamp": r.decision_time.replace(tzinfo=timezone.utc).isoformat() if r.decision_time else None,
            }
            for r in my_records[:5]
        ],
    }


@router.get("/engagement", dependencies=[Depends(require_roles([1, 2]))])
async def get_engagement_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.models.engagement import EngagementMetric

    # 1. Fetch sessions matching the organization and role scope
    if current_user.role_id == 1:
        sessions_stmt = select(SessionModel).where(SessionModel.org_id == current_user.org_id)
    else:
        sessions_stmt = select(SessionModel).where(
            SessionModel.created_by == current_user.user_id,
            SessionModel.org_id == current_user.org_id
        )
        
    sessions_res = await db.execute(sessions_stmt)
    sessions = sessions_res.scalars().all()
    session_ids = [s.session_id for s in sessions]
    
    if not session_ids:
        return {
            "courses": [],
            "line_chart_data": {},
            "scatter_chart_data": {},
            "alert_students": {}
        }
        
    # 2. Group sessions by unique subject/class name
    courses_map = {}
    for s in sessions:
        if s.session_name not in courses_map:
            courses_map[s.session_name] = []
        courses_map[s.session_name].append(s)
        
    courses_list = [{"id": sub, "name": sub} for sub in courses_map.keys()]
    
    line_chart_data = {}
    scatter_chart_data = {}
    alert_students = {}
    
    # 3. Process each course subject category
    for subject_name, course_sessions in courses_map.items():
        course_session_ids = [cs.session_id for cs in course_sessions]
        
        # Join User, AttendanceRecord, EngagementMetric to query active logs
        stmt = (
            select(
                User.user_id,
                User.full_name,
                AttendanceRecord.session_id,
                EngagementMetric.attention_score,
                EngagementMetric.eye_gaze_score,
                EngagementMetric.engagement_level
            )
            .join(AttendanceRecord, User.user_id == AttendanceRecord.user_id)
            .join(SessionModel, AttendanceRecord.session_id == SessionModel.session_id)
            .join(EngagementMetric, AttendanceRecord.attendance_id == EngagementMetric.attendance_id)
            .where(AttendanceRecord.session_id.in_(course_session_ids))
        )
        res = await db.execute(stmt)
        records = res.all()
        
        # 3.1. Line Chart Data
        sorted_sessions = sorted(course_sessions, key=lambda cs: cs.start_time or datetime.min)
        subject_line_data = []
        for idx, cs in enumerate(sorted_sessions):
            session_metrics = [r for r in records if r.session_id == cs.session_id]
            if session_metrics:
                avg_att = sum(r.attention_score for r in session_metrics) / len(session_metrics)
            else:
                avg_att = 0.0
            subject_line_data.append({
                "label": f"Lec {idx+1}",
                "value": round(avg_att * 25.0, 1), # Max 25 focus minutes
                "percentage": round(avg_att * 100, 1)
            })
        line_chart_data[subject_name] = subject_line_data
        
        # 3.2. Scatter Plot & Alert Students Grouping
        student_groups = {}
        for r in records:
            if r.user_id not in student_groups:
                student_groups[r.user_id] = {
                    "name": r.full_name,
                    "att_scores": [],
                    "gaze_scores": [],
                    "levels": []
                }
            student_groups[r.user_id]["att_scores"].append(r.attention_score)
            student_groups[r.user_id]["gaze_scores"].append(r.eye_gaze_score)
            student_groups[r.user_id]["levels"].append(r.engagement_level)
            
        subject_scatter_data = []
        subject_alerts = []
        
        total_course_sessions = len(course_sessions)
        
        for uid, sdata in student_groups.items():
            stu_att_rate = min(100.0, (len(sdata["att_scores"]) / total_course_sessions * 100) if total_course_sessions > 0 else 0.0)
            avg_attention = sum(sdata["att_scores"]) / len(sdata["att_scores"]) if sdata["att_scores"] else 0.0
            avg_gaze = sum(sdata["gaze_scores"]) / len(sdata["gaze_scores"]) if sdata["gaze_scores"] else 0.0
            
            participation = round(avg_gaze * 100, 1)
            attendance_percent = round(stu_att_rate, 1)
            mean_att = avg_attention * 100
            
            if mean_att >= 80:
                status = "high"
            elif mean_att >= 60:
                status = "medium"
            else:
                status = "low"
                
            subject_scatter_data.append({
                "name": sdata["name"],
                "attendance": attendance_percent,
                "participation": participation,
                "status": status
            })
            
            if mean_att < 60:
                sparkline = [round(v * 100, 1) for v in sdata["att_scores"][-6:]]
                if len(sparkline) < 6:
                    sparkline = [sparkline[0] if sparkline else 50] * (6 - len(sparkline)) + sparkline
                subject_alerts.append({
                    "id": uid,
                    "name": sdata["name"],
                    "avatar": "".join(part[0].upper() for part in sdata["name"].split()[:2]) if sdata["name"] else "ST",
                    "attendance": attendance_percent,
                    "attention": round(mean_att, 1),
                    "status": "critical" if mean_att < 50 else "warning",
                    "trend": "down" if len(sdata["att_scores"]) > 1 and sdata["att_scores"][-1] < sdata["att_scores"][-2] else "stable",
                    "sparkline": sparkline
                })
                
        scatter_chart_data[subject_name] = subject_scatter_data
        alert_students[subject_name] = subject_alerts
        
    return {
        "courses": courses_list,
        "line_chart_data": line_chart_data,
        "scatter_chart_data": scatter_chart_data,
        "alert_students": alert_students
    }
