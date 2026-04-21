from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.attendance import AttendanceRecord as Attendance
from app.models.ai_decision import AIDecisionLog
import logging

logger = logging.getLogger(__name__)

# ── In-process caches (reset per session) ─────────────────────────────────────
# Maps session_id -> set of user_ids already written as provisional/present.
# Avoids a DB query on every frame for users we already know about.
_provisional_cache: dict[int, set] = {}
_confirmed_cache: dict[int, set] = {}


def _clear_session_cache(session_id: int):
    """Call at session end to free memory."""
    _provisional_cache.pop(session_id, None)
    _confirmed_cache.pop(session_id, None)


async def mark_provisional(db: AsyncSession, session_id: int, decisions: list) -> list[dict]:
    """
    Stage 1 – instant write on first detection.
    In-process cache ensures we hit the DB only ONCE per user per session.
    """
    prov_set = _provisional_cache.setdefault(session_id, set())
    conf_set = _confirmed_cache.get(session_id, set())

    # Users we haven't seen yet AND aren't already confirmed/fraud
    new_ids = [
        d["user_id"] for d in decisions
        if d.get("user_id")
        and not d.get("is_fraud")
        and d["user_id"] not in prov_set
        and d["user_id"] not in conf_set
    ]
    if not new_ids:
        return []

    # One bulk check: maybe they were written in a previous server restart
    result = await db.execute(
        select(Attendance.user_id, Attendance.final_status).where(
            Attendance.session_id == session_id,
            Attendance.user_id.in_(new_ids),
        )
    )
    already = {row.user_id: row.final_status for row in result.all()}

    # Seed caches from DB results so future frames skip the DB entirely
    for uid, status in already.items():
        prov_set.add(uid)
        if status in ("present", "fraud"):
            _confirmed_cache.setdefault(session_id, set()).add(uid)

    # Only insert genuinely new rows
    to_insert = [uid for uid in new_ids if uid not in already]
    if not to_insert:
        return []

    new_records: list[Attendance] = []
    for d in decisions:
        uid = d.get("user_id")
        if uid not in to_insert:
            continue
        rec = Attendance(
            session_id=session_id,
            user_id=uid,
            final_status="provisional",
            final_score=float(d.get("confidence") or 0.0),
            decision_time=datetime.utcnow(),
        )
        new_records.append(rec)

    if new_records:
        try:
            for rec in new_records:
                db.add(rec)
                prov_set.add(rec.user_id)   # cache immediately
            await db.commit()
            logger.info(
                f"[Session {session_id}] Provisional +{len(new_records)}: "
                f"{[r.user_id for r in new_records]}"
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Provisional write failed: {e}")
            return []

    return [{"user_id": r.user_id, "status": "provisional"} for r in new_records]


async def apply_ai_decisions(db: AsyncSession, session_id: int, decisions: list) -> list:
    """
    Stage 2 – upgrade provisional → present once the presence tracker confirms.
    In-process cache means zero DB work for users already marked present.
    """
    conf_set = _confirmed_cache.setdefault(session_id, set())
    prov_set = _provisional_cache.get(session_id, set())

    # Only process confirmed, non-fraud faces not yet in the confirmed cache
    to_upgrade = [
        d for d in decisions
        if d.get("confirmed")
        and d.get("user_id")
        and d["user_id"] not in conf_set
    ]
    if not to_upgrade:
        return []

    candidate_ids = [d["user_id"] for d in to_upgrade]

    # Bulk fetch — may be provisional rows or brand-new
    existing_result = await db.execute(
        select(Attendance).where(
            Attendance.session_id == session_id,
            Attendance.user_id.in_(candidate_ids),
        )
    )
    existing_map: dict[int, Attendance] = {
        r.user_id: r for r in existing_result.scalars().all()
    }

    results: list[Attendance] = []
    brand_new: list[tuple] = []

    for d in to_upgrade:
        uid = d["user_id"]
        is_fraud = d.get("is_fraud", False)
        final_status = "fraud" if is_fraud else "present"
        confidence = float(d.get("confidence") or 0.0)

        existing = existing_map.get(uid)
        if existing:
            if existing.final_status not in ("present", "fraud"):
                existing.final_status = final_status
                existing.final_score = confidence
                existing.decision_time = datetime.utcnow()
                db.add(existing)
                logger.info(f"Upgraded user {uid} → {final_status} (session {session_id})")
            conf_set.add(uid)
            results.append(existing)
        else:
            # No provisional row yet (edge case) — insert directly as present
            rec = Attendance(
                session_id=session_id,
                user_id=uid,
                final_status=final_status,
                final_score=confidence,
                decision_time=datetime.utcnow(),
            )
            brand_new.append((rec, d))

    ai_logs: list[AIDecisionLog] = []

    if brand_new:
        try:
            for rec, _ in brand_new:
                db.add(rec)
            await db.flush()
            for rec, d in brand_new:
                ai_logs.append(AIDecisionLog(
                    attendance_id=rec.attendance_id,
                    model_name="deepface_facenet512_liveness",
                    confidence_score=float(d.get("confidence") or 0.0),
                    decision_reason=d.get("reason") or ("fraud_detected" if d.get("is_fraud") else "confirmed_genuine"),
                ))
            for log in ai_logs:
                db.add(log)
        except Exception as e:
            await db.rollback()
            logger.error(f"Brand-new confirmed write failed: {e}")
            return results

    try:
        await db.commit()
        for rec, d in brand_new:
            await db.refresh(rec)
            conf_set.add(rec.user_id)
            prov_set.add(rec.user_id)
            logger.info(f"Confirmed new {rec.user_id} as {rec.final_status} (session {session_id})")
            results.append(rec)
    except Exception as e:
        await db.rollback()
        logger.error(f"Commit failed for session {session_id}: {e}")

    return results
