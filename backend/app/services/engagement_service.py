"""
Engagement Service — provides aggregated engagement metrics per session.
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.engagement import EngagementMetric
from app.models.attendance import AttendanceRecord

logger = logging.getLogger(__name__)


async def get_engagement_summary(session_id: int, db: AsyncSession) -> dict:
    """
    Return aggregated engagement stats for a session.

    Args:
        session_id: The session to summarise.
        db:         Async database session.

    Returns:
        dict with avg_attention, avg_engagement, low_engagement_count,
        and total_records.
    """
    # Get all attendance_ids for this session
    result = await db.execute(
        select(AttendanceRecord.attendance_id).where(
            AttendanceRecord.session_id == session_id
        )
    )
    attendance_ids = [row[0] for row in result.fetchall()]

    if not attendance_ids:
        return {
            "avg_attention": 0.0,
            "avg_engagement": 0.0,
            "low_engagement_count": 0,
            "total_records": 0,
        }

    # Aggregate engagement metrics
    metrics_result = await db.execute(
        select(
            func.avg(EngagementMetric.attention_score).label("avg_attention"),
            func.avg(EngagementMetric.eye_gaze_score).label("avg_gaze"),
            func.count(EngagementMetric.engagement_id).label("total"),
        ).where(EngagementMetric.attendance_id.in_(attendance_ids))
    )
    row = metrics_result.fetchone()

    low_count_result = await db.execute(
        select(func.count(EngagementMetric.engagement_id)).where(
            EngagementMetric.attendance_id.in_(attendance_ids),
            EngagementMetric.engagement_level == "low",
        )
    )
    low_count = low_count_result.scalar() or 0

    avg_attention = round(float(row.avg_attention or 0), 2)
    avg_gaze = round(float(row.avg_gaze or 0), 2)
    avg_overall = round((avg_attention + avg_gaze) / 2, 2)

    logger.debug(
        f"Engagement summary for session {session_id}: "
        f"avg={avg_overall}, low={low_count}"
    )

    return {
        "avg_attention": avg_attention,
        "avg_engagement": avg_overall,
        "low_engagement_count": low_count,
        "total_records": row.total or 0,
    }


async def get_org_low_engagement_count(session_ids: list[int], db: AsyncSession) -> int:
    """Count low-engagement records across multiple sessions."""
    if not session_ids:
        return 0

    result = await db.execute(
        select(AttendanceRecord.attendance_id).where(
            AttendanceRecord.session_id.in_(session_ids)
        )
    )
    att_ids = [row[0] for row in result.fetchall()]
    if not att_ids:
        return 0

    count = await db.scalar(
        select(func.count(EngagementMetric.engagement_id)).where(
            EngagementMetric.attendance_id.in_(att_ids),
            EngagementMetric.engagement_level == "low",
        )
    )
    return count or 0
