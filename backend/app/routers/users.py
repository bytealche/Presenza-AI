from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError


from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.user_schema import UserCreate, UserResponse
from app.core.security import hash_password

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.post("/", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    try:
        hashed_password = hash_password(user.password)

        new_user = User(
            full_name=user.full_name,
            email=user.email,
            password_hash=hashed_password,
            org_id=user.org_id,
            role_id=user.role_id
        )

        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        return new_user  # ✅ ALWAYS return on success

    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="Invalid organization ID, role ID, or duplicate email"
        )

    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
