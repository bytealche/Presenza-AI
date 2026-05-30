from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from app.database.dependencies import get_db
from app.models.attendance import AttendanceRecord as Attendance
from app.models.enrollment import Enrollment
from app.models.session import Session as SessionModel
from app.schemas.attendance_schema import AttendanceMark, AttendanceOverrideRequest
from app.core.role_dependencies import require_roles
from app.core.rate_limit import limiter
from app.core.auth_dependencies import get_current_user
from app.models.user import User

router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"]
)

@router.post(
    "/mark",
    dependencies=[Depends(require_roles([2]))]  # teacher
)
@limiter.limit("20/minute")
async def mark_attendance(
    request: Request,
    data: AttendanceMark,
    db: AsyncSession = Depends(get_db)
):
    # 1️⃣ Check session exists
    result = await db.execute(select(SessionModel).where(SessionModel.session_id == data.session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(404, "Session not found")

    # 2️⃣ Check session time validity
    now = datetime.utcnow()
    if not (session.start_time <= now <= session.end_time):
        raise HTTPException(400, "Session not active")

    # 3️⃣ Check enrollment
    result = await db.execute(select(Enrollment).where(
        Enrollment.session_id == data.session_id,
        Enrollment.user_id == data.user_id
    ))
    enrolled = result.scalars().first()
    if not enrolled:
        raise HTTPException(403, "Student not enrolled")

    # 4️⃣ Prevent duplicate attendance
    result = await db.execute(select(Attendance).where(
        Attendance.session_id == data.session_id,
        Attendance.user_id == data.user_id
    ))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(400, "Attendance already marked")

    # 5️⃣ Save attendance
    attendance = Attendance(
        session_id=data.session_id,
        user_id=data.user_id,
        org_id=session.org_id,
        final_status=data.final_status,
        final_score=data.final_score,
        decision_time=datetime.utcnow()
    )

    db.add(attendance)
    await db.commit()
    return {"message": "Attendance recorded successfully"}

@router.get("/session/{session_id}")
async def get_session_attendance(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Check permissions (Admin or Teacher)
    if current_user.role_id not in [1, 2]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # 2. Check Session
    result = await db.execute(select(SessionModel).where(SessionModel.session_id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # 3. If Teacher, must be MY session
    if current_user.role_id == 2 and session.created_by != current_user.user_id:
         raise HTTPException(status_code=403, detail="Not your session")
         
    # 4. Get Enrollments (All students in this class)
    # We want User details too.
    # Join with User, left outer join with Attendance
    result = await db.execute(
        select(User, Attendance)
        .select_from(Enrollment)
        .join(User, Enrollment.user_id == User.user_id)
        .outerjoin(
            Attendance,
            (Enrollment.user_id == Attendance.user_id) & (Enrollment.session_id == Attendance.session_id)
        )
        .where(Enrollment.session_id == session_id)
    )
    results = result.all()


    
    return [
        {
            "user_id": r[0].user_id,
            "full_name": r[0].full_name,
            "email": r[0].email,
            "status": r[1].final_status if r[1] is not None else "Absent",
            "timestamp": r[1].decision_time if r[1] is not None else None
        }
        for r in results
    ]

@router.post(
    "/save-overrides",
    dependencies=[Depends(require_roles([1, 2]))]  # admin + teacher
)
async def save_overrides(
    request: Request,
    data: AttendanceOverrideRequest,
    db: AsyncSession = Depends(get_db)
):
    # 1️⃣ Check session exists
    result = await db.execute(select(SessionModel).where(SessionModel.session_id == data.session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(404, "Session not found")

    # 2️⃣ Process each override
    for item in data.overrides:
        stmt = select(Attendance).where(
            Attendance.session_id == data.session_id,
            Attendance.user_id == item.user_id
        )
        existing_result = await db.execute(stmt)
        attendance = existing_result.scalars().first()
        
        # Determine appropriate score based on the override status
        score = 1.0 if item.status.lower() in ["present", "late"] else 0.0
        
        if attendance:
            attendance.final_status = item.status
            attendance.decision_time = datetime.utcnow()
            if item.status.lower() in ["absent", "fraud"]:
                attendance.final_score = 0.0
            elif attendance.final_score is None:
                attendance.final_score = 1.0
        else:
            attendance = Attendance(
                session_id=data.session_id,
                user_id=item.user_id,
                org_id=session.org_id,
                final_status=item.status,
                final_score=score,
                decision_time=datetime.utcnow()
            )
            db.add(attendance)
            
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(400, f"Database integrity error: {str(e)}")
        
    return {"message": "Overrides saved successfully"}

