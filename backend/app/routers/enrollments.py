from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from datetime import datetime

from app.database.dependencies import get_db
from app.models.enrollment import Enrollment
from app.models.user import User
from app.schemas.enrollment_schema import EnrollmentCreate, EnrollmentResponse
from app.core.role_dependencies import require_roles
from app.core.auth_dependencies import get_current_user

router = APIRouter(
    prefix="/enrollments",
    tags=["Enrollments"]
)

class SubjectEnrollmentRequest(BaseModel):
    subject_name: str

@router.post(
    "/",
    response_model=EnrollmentResponse,
    dependencies=[Depends(require_roles([2, 3]))]  # teacher + student
)
async def enroll_student(
    data: EnrollmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Security check: if student, they can only enroll themselves
    if current_user.role_id == 3 and data.user_id != current_user.user_id:
        raise HTTPException(
            status_code=403,
            detail="Students can only enroll themselves"
        )

    try:
        enrollment = Enrollment(
            session_id=data.session_id,
            user_id=data.user_id
        )
        db.add(enrollment)
        await db.commit()
        await db.refresh(enrollment)
        return enrollment

    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Student already enrolled or invalid IDs"
        )

@router.post(
    "/subject",
    dependencies=[Depends(require_roles([3]))] # student
)
async def enroll_in_subject(
    data: SubjectEnrollmentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Insert into subject_enrollments
    try:
        await db.execute(
            text("""
                INSERT INTO subject_enrollments (user_id, subject_name)
                VALUES (:user_id, :subject_name)
            """),
            {"user_id": current_user.user_id, "subject_name": data.subject_name}
        )
        await db.commit()
    except Exception:
        # Unique constraint handles if already enrolled
        await db.rollback()
        pass

    # 2. Find all sessions in the organization that match this subject name
    from app.models.session import Session as SessionModel
    sessions_result = await db.execute(
        select(SessionModel).where(
            SessionModel.session_name == data.subject_name,
            SessionModel.org_id == current_user.org_id
        )
    )
    sessions = sessions_result.scalars().all()

    # 3. Enroll the student in all these sessions
    enrolled_count = 0
    for session in sessions:
        # Check if enrollment already exists
        existing = await db.execute(
            select(Enrollment).where(
                Enrollment.session_id == session.session_id,
                Enrollment.user_id == current_user.user_id
            )
        )
        if not existing.scalars().first():
            new_enrollment = Enrollment(
                session_id=session.session_id,
                user_id=current_user.user_id,
                enrolled_at=datetime.utcnow()
            )
            db.add(new_enrollment)
            enrolled_count += 1
    
    await db.commit()
    return {"message": f"Successfully enrolled in subject '{data.subject_name}'!", "enrolled_sessions_count": enrolled_count}

@router.get(
    "/subject/my",
    dependencies=[Depends(require_roles([3]))] # student
)
async def get_my_subject_enrollments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        text("SELECT subject_name FROM subject_enrollments WHERE user_id = :user_id"),
        {"user_id": current_user.user_id}
    )
    return [row.subject_name for row in result.fetchall()]

@router.get(
    "/session/{session_id}",
    dependencies=[Depends(require_roles([2]))]
)
async def get_enrolled_students(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Enrollment)
        .where(Enrollment.session_id == session_id)
    )
    return result.scalars().all()

@router.get(
    "/my",
    response_model=list[EnrollmentResponse],
    dependencies=[Depends(require_roles([3]))] # student
)
async def get_my_enrollments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Return all enrollments for this student
    result = await db.execute(select(Enrollment).where(Enrollment.user_id == current_user.user_id))
    return result.scalars().all()
