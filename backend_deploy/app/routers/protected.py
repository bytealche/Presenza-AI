from fastapi import APIRouter, Depends
from app.core.role_dependencies import require_roles
from app.models.user import User

router = APIRouter(
    prefix="/protected",
    tags=["Protected"]
)

@router.get("/admin")
def admin_only(
    user: User = Depends(require_roles([1]))  # admin
):
    return {"message": f"Welcome Admin {user.full_name}"}


@router.get("/teacher")
def teacher_only(
    user: User = Depends(require_roles([2]))  # teacher
):
    return {"message": f"Welcome Teacher {user.full_name}"}


@router.get("/student")
def student_only(
    user: User = Depends(require_roles([3]))  # student
):
    return {"message": f"Welcome Student {user.full_name}"}
