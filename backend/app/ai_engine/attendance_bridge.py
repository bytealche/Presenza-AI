from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.attendance import AttendanceRecord as Attendance
from app.models.session import Session as SessionModel
import logging

logger = logging.getLogger(__name__)

async def apply_ai_decisions(db: AsyncSession, session_id: int, decisions: list):
    """
    Auto-mark attendance from AI analysis.
    No enrollment check — AI decides who is present/fraud.
    Duplicate records are skipped (idempotent).
    """
    results = []

    for d in decisions:
        if not d.get("confirmed"):
            continue

        user_id = d.get("user_id")
        if not user_id:
            continue  # Unknown face, skip

        confidence = d.get("confidence", 0.0)
        is_fraud = d.get("is_fraud", False)
        engagement_score = d.get("engagement_score")

        # Determine attendance status
        if is_fraud:
            final_status = "fraud"
        else:
            final_status = "present"

        # Prevent duplicate attendance (idempotent)
        result = await db.execute(select(Attendance).where(
            Attendance.session_id == session_id,
            Attendance.user_id == user_id
        ))
        existing = result.scalars().first()

        if existing:
            # If previously marked present but now fraud, update
            if is_fraud and existing.final_status != "fraud":
                existing.final_status = "fraud"
                existing.decision_time = datetime.utcnow()
                db.add(existing)
                await db.commit()
                logger.info(f"Updated user {user_id} to FRAUD in session {session_id}")
            results.append(existing)
            continue

        # Create new record
        attendance = Attendance(
            session_id=session_id,
            user_id=user_id,
            final_status=final_status,
            final_score=float(confidence) if confidence else None,
            decision_time=datetime.utcnow()
        )
        db.add(attendance)
        try:
            await db.commit()
            await db.refresh(attendance)
            logger.info(f"Marked {user_id} as {final_status} in session {session_id}")
            results.append(attendance)
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to mark attendance for user {user_id}: {e}")

    return results
