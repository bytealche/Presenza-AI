from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.models.attendance import AttendanceRecord as Attendance
from app.models.enrollment import Enrollment
from app.models.session import Session as SessionModel

async def record_attendance(
    db: AsyncSession,
    session_id: int,
    user_id: int,
    final_status: str,
    final_score: float | None
):
    # 1️⃣ Validate session
    result = await db.execute(select(SessionModel).where(SessionModel.session_id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(404, "Session not found")

    now = datetime.utcnow()
    if not (session.start_time <= now <= session.end_time):
        raise HTTPException(400, "Session not active")

    # 2️⃣ Validate enrollment
    result = await db.execute(select(Enrollment).where(
        Enrollment.session_id == session_id,
        Enrollment.user_id == user_id
    ))
    enrolled = result.scalars().first()
    if not enrolled:
        raise HTTPException(403, "User not enrolled")

    # 3️⃣ Prevent duplicates
    result = await db.execute(select(Attendance).where(
        Attendance.session_id == session_id,
        Attendance.user_id == user_id
    ))
    existing = result.scalars().first()
    if existing:
        return existing  # idempotent

    # 4️⃣ Save attendance
    attendance = Attendance(
        session_id=session_id,
        user_id=user_id,
        final_status=final_status,
        final_score=final_score,
        decision_time=datetime.utcnow()
    )

    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)
    return attendance
