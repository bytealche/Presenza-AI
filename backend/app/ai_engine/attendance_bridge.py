from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.attendance import AttendanceRecord as Attendance
from app.models.ai_decision import AIDecisionLog
from app.models.session import Session as SessionModel
import logging

logger = logging.getLogger(__name__)


async def mark_provisional(db: AsyncSession, session_id: int, decisions: list) -> list[dict]:
    """
    Stage 1: Immediately mark any recognized face as 'provisional' attendance.
    Called on every frame — fast because it only acts on newly-seen user_ids.
    Returns list of {user_id, status} for the live sidebar.
    """
    # Collect all recognized user_ids (confirmed OR not, just recognized)
    candidate_ids = [
        d["user_id"] for d in decisions
        if d.get("user_id") and not d.get("is_fraud")
    ]
    if not candidate_ids:
        return []

    # Bulk check what's already in DB for this session
    result = await db.execute(
        select(Attendance.user_id, Attendance.final_status).where(
            Attendance.session_id == session_id,
            Attendance.user_id.in_(candidate_ids)
        )
    )
    existing = {row.user_id: row.final_status for row in result.all()}

    new_records = []
    for d in decisions:
        user_id = d.get("user_id")
        if not user_id or d.get("is_fraud"):
            continue

        # Already present/fraud — leave it alone. Already provisional — skip.
        if user_id in existing:
            continue

        attendance = Attendance(
            session_id=session_id,
            user_id=user_id,
            final_status="provisional",
            final_score=float(d.get("confidence", 0.0)),
            decision_time=datetime.utcnow()
        )
        new_records.append(attendance)

    if new_records:
        try:
            for rec in new_records:
                db.add(rec)
            await db.commit()
            logger.info(
                f"[Session {session_id}] Provisionally marked {len(new_records)} faces: "
                f"{[r.user_id for r in new_records]}"
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Provisional write failed: {e}")

    return [{"user_id": r.user_id, "status": "provisional"} for r in new_records]


async def apply_ai_decisions(db: AsyncSession, session_id: int, decisions: list):
    """
    Stage 2: Upgrade provisional → present (or → fraud) once the presence
    tracker has confirmed a face over multiple frames.
    All writes are batched into a single transaction.
    """
    results = []
    to_confirm = []   # (user_id, confidence, is_fraud, reason)

    candidate_user_ids = [
        d["user_id"] for d in decisions
        if d.get("confirmed") and d.get("user_id")
    ]
    if not candidate_user_ids:
        return results

    # Bulk fetch existing records in one query
    existing_result = await db.execute(
        select(Attendance).where(
            Attendance.session_id == session_id,
            Attendance.user_id.in_(candidate_user_ids)
        )
    )
    existing_map = {r.user_id: r for r in existing_result.scalars().all()}

    ai_logs = []

    for d in decisions:
        if not d.get("confirmed"):
            continue
        user_id = d.get("user_id")
        if not user_id:
            continue

        confidence = d.get("confidence", 0.0)
        is_fraud = d.get("is_fraud", False)
        final_status = "fraud" if is_fraud else "present"

        existing = existing_map.get(user_id)

        if existing:
            # Upgrade provisional → present, or flag fraud
            if existing.final_status == "provisional" or (is_fraud and existing.final_status != "fraud"):
                existing.final_status = final_status
                existing.final_score = float(confidence) if confidence else existing.final_score
                existing.decision_time = datetime.utcnow()
                db.add(existing)
                logger.info(f"Upgraded user {user_id} → {final_status} in session {session_id}")
            results.append(existing)
            continue

        # Brand new confirmed record (no provisional was written first — edge case)
        attendance = Attendance(
            session_id=session_id,
            user_id=user_id,
            final_status=final_status,
            final_score=float(confidence) if confidence else None,
            decision_time=datetime.utcnow()
        )
        to_confirm.append((attendance, d))

    # Batch insert new confirmed records
    if to_confirm:
        try:
            for rec, _ in to_confirm:
                db.add(rec)
            await db.flush()

            for rec, d in to_confirm:
                is_fraud = d.get("is_fraud", False)
                ai_log = AIDecisionLog(
                    attendance_id=rec.attendance_id,
                    model_name="deepface_facenet512_liveness",
                    confidence_score=float(d.get("confidence", 0.0)),
                    decision_reason=d.get("reason") or ("fraud_detected" if is_fraud else "confirmed_genuine")
                )
                ai_logs.append(ai_log)

            for log in ai_logs:
                db.add(log)
        except Exception as e:
            await db.rollback()
            logger.error(f"Batch confirmed write failed: {e}")
            return results

    try:
        await db.commit()
        for rec, d in to_confirm:
            await db.refresh(rec)
            logger.info(f"Confirmed {rec.user_id} as {rec.final_status} in session {session_id}")
            results.append(rec)
    except Exception as e:
        await db.rollback()
        logger.error(f"Commit failed for session {session_id}: {e}")

    return results
