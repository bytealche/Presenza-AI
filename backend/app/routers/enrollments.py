from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

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

@router.post(
    "/",
    response_model=EnrollmentResponse,
    dependencies=[Depends(require_roles([2]))]  # teacher
)
async def enroll_student(
    data: EnrollmentCreate,
    db: AsyncSession = Depends(get_db)
):
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
