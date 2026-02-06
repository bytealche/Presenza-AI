from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.user import User
from app.schemas.auth_schema import LoginRequest, TokenResponse
from app.core.security import verify_password, create_access_token

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

    if not user:
        print(f"DEBUG: Login failed - User not found for email: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    print(f"DEBUG: Found user {user.email}, verifying password...")
    try:
        is_valid = verify_password(data.password, user.password_hash)
        print(f"DEBUG: Password verification result: {is_valid}")
    except Exception as e:
        print(f"DEBUG: Password verification error: {e}")
        is_valid = False

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        data={"user_id": user.user_id, "role_id": user.role_id}
    )

    return {"access_token": token}
"""from passlib.exc import UnknownHashError

try:
    valid = verify_password(data.password, user.password_hash)
except UnknownHashError:
    raise HTTPException(status_code=401, detail="Invalid credentials")

if not valid:
    raise HTTPException(status_code=401, detail="Invalid credentials")"""
