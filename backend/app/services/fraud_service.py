"""
Fraud Service — queries system_logs for suspicious/fraud events per session.
"""
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.system_log import SystemLog
from app.models.attendance import AttendanceRecord

logger = logging.getLogger(__name__)

# Actions in SystemLog that represent fraud / security alerts
FRAUD_ACTIONS = ("fraud_detected", "unknown_face", "liveness_failed", "spoofing_attempt")


async def get_fraud_alert_count(session_id: int, db: AsyncSession) -> int:
    """
    Return the count of fraud/security alert log entries for a session.

    Looks at system_logs for actions flagged as suspicious that are
    associated with users who appear in the session's attendance records.
    """
    # Get user_ids present in this session
    result = await db.execute(
        select(AttendanceRecord.user_id).where(
            AttendanceRecord.session_id == session_id
        )
    )
    user_ids = [row[0] for row in result.fetchall()]

    if not user_ids:
        # Count unknown-face logs that occurred during session window
        # (no user_id association — stored with user_id=None)
        count = await db.scalar(
            select(func.count(SystemLog.log_id)).where(
                SystemLog.action.in_(FRAUD_ACTIONS),
                SystemLog.user_id.is_(None),
            )
        )
        return count or 0

    count = await db.scalar(
        select(func.count(SystemLog.log_id)).where(
            SystemLog.action.in_(FRAUD_ACTIONS),
            SystemLog.user_id.in_(user_ids),
        )
    )
    logger.debug(f"Fraud alerts for session {session_id}: {count}")
    return count or 0


async def get_total_fraud_alerts(db: AsyncSession) -> int:
    """Return count of all fraud/security alerts across the platform."""
    count = await db.scalar(
        select(func.count(SystemLog.log_id)).where(
            SystemLog.action.in_(FRAUD_ACTIONS)
        )
    )
    return count or 0


async def get_recent_fraud_alerts(db: AsyncSession, limit: int = 10) -> list[dict]:
    """Return the most recent fraud alert entries."""
    result = await db.execute(
        select(SystemLog)
        .where(SystemLog.action.in_(FRAUD_ACTIONS))
        .order_by(SystemLog.timestamp.desc())
        .limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "log_id": log.log_id,
            "user_id": log.user_id,
            "action": log.action,
            "ip_address": log.ip_address,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
        }
        for log in logs
    ]
