from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database.dependencies import get_db
from app.models.enrollment import Enrollment
from app.schemas.enrollment_schema import EnrollmentCreate, EnrollmentResponse
from app.core.role_dependencies import require_roles

router = APIRouter(
    prefix="/enrollments",
    tags=["Enrollments"]
)

@router.post(
    "/",
    response_model=EnrollmentResponse,
    dependencies=[Depends(require_roles([2]))]  # teacher
)
def enroll_student(
    data: EnrollmentCreate,
    db: Session = Depends(get_db)
):
    try:
        enrollment = Enrollment(
            session_id=data.session_id,
            user_id=data.user_id
        )
        db.add(enrollment)
        db.commit()
        db.refresh(enrollment)
        return enrollment

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Student already enrolled or invalid IDs"
        )
@router.get(
    "/session/{session_id}",
    dependencies=[Depends(require_roles([2]))]
)
def get_enrolled_students(
    session_id: int,
    db: Session = Depends(get_db)
):
    enrollments = (
        db.query(Enrollment)
        .filter(Enrollment.session_id == session_id)
        .all()
    )
    return enrollments
