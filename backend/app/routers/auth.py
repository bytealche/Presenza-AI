from fastapi import APIRouter, Depends, HTTPException, status, Body, UploadFile, File, Form, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta, timezone
import random
import string
import logging
import numpy as np
import cv2
from jose import JWTError

from app.core.rate_limit import limiter
from app.database.dependencies import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.verification_code import VerificationCode
from app.models.role import Role
from app.schemas.auth_schema import LoginRequest, TokenResponse, RefreshRequest
from app.schemas.auth_schema_extended import OTPRequest, OrganizationRegisterRequest, UserRegisterRequest
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token, hash_password
from app.ai_engine.face_detection import detect_faces
from app.ai_engine.liveness_detection import LivenessDetector
from app.ai_engine.face_embedding import generate_embedding
from app.ai_engine.vector_store import find_match
from app.core.email import send_email_sync

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Helpers ─────────────────────────────────────────────────────────────────

def generate_otp() -> str:
    return "".join(random.choices(string.digits, k=6))


def _build_token_payload(user: User) -> dict:
    return {
        "user_id": user.user_id,
        "role_id": user.role_id,
        "org_id": user.org_id,
        "full_name": user.full_name,
        "email": user.email,
    }


async def verify_otp_logic(email: str, code: str, db: AsyncSession) -> bool:
    result = await db.execute(
        select(VerificationCode).where(
            VerificationCode.email == email,
            VerificationCode.code == code,
        )
    )
    record = result.scalars().first()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    if not record.is_valid():
        raise HTTPException(status_code=400, detail="OTP expired")

    await db.delete(record)
    await db.commit()
    return True


# ── Routes ──────────────────────────────────────────────────────────────────

@router.post("/send-otp")
@limiter.limit("5/minute")
async def send_otp(
    request: Request,
    data: OTPRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)

    # Invalidate any previous codes for this email
    await db.execute(delete(VerificationCode).where(VerificationCode.email == data.email))

    vc = VerificationCode(email=data.email, code=code, expires_at=expires_at)
    db.add(vc)
    await db.commit()

    subject = "Verify your Presenza AI Account"
    body = f"Your verification code is: {code}\n\nThis code will expire in 10 minutes."
    background_tasks.add_task(send_email_sync, data.email, subject, body)

    logger.info(f"OTP sent to {data.email}")
    return {"message": "OTP sent. Please check your email (and spam folder)."}


@router.post("/register-organization")
@limiter.limit("5/minute")
async def register_organization(
    request: Request,
    data: OrganizationRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    logger.info(f"Registering organisation: {data.org_name} ({data.email})")
    try:
        await verify_otp_logic(data.email, data.otp, db)

        result = await db.execute(select(User).where(User.email == data.email))
        if result.scalars().first():
            raise HTTPException(status_code=400, detail="Email already registered")

        new_org = Organization(org_name=data.org_name, org_type="Organization")
        db.add(new_org)
        await db.flush()

        hashed = hash_password(data.password)
        new_user = User(
            full_name=f"Admin - {data.org_name}",
            email=data.email,
            password_hash=hashed,
            org_id=new_org.org_id,
            role_id=1,  # Admin
            status="active",
        )
        db.add(new_user)
        await db.commit()
        logger.info(f"Organisation '{data.org_name}' registered successfully")
        return {"message": "Organisation registered successfully"}
    except HTTPException:
        raise
    except Exception:
        logger.exception(f"Unexpected error during organisation registration for {data.email}")
        raise


@router.post("/register-user")
@limiter.limit("5/minute")
async def register_user(
    request: Request,
    data: UserRegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    await verify_otp_logic(data.email, data.otp, db)

    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user_status = "pending" if (data.role_id == 2 and data.org_id) else "active"

    hashed = hash_password(data.password)
    new_user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hashed,
        org_id=data.org_id,
        role_id=data.role_id,
        status=user_status,
    )
    db.add(new_user)
    await db.commit()
    logger.info(f"User '{data.email}' registered (status={user_status})")

    msg = "User registered successfully."
    if user_status == "pending":
        msg += " Waiting for organisation approval."
    return {"message": msg}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()

    if not user:
        logger.warning(f"Login attempt for non-existent email: {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account is pending approval or suspended.")

    if not verify_password(data.password, user.password_hash):
        logger.warning(f"Failed login attempt for {data.email}")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    payload = _build_token_payload(user)
    access_token = create_access_token(data=payload)
    refresh_token = create_refresh_token(data={"user_id": user.user_id, "email": user.email})

    logger.info(f"User '{data.email}' logged in successfully")
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
    }


@router.post("/refresh", response_model=TokenResponse)
async def refresh_access_token(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Exchange a valid refresh token for a new access token."""
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_error
        user_id: int = payload.get("user_id")
        if not user_id:
            raise credentials_error
    except JWTError:
        raise credentials_error

    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalars().first()
    if not user or user.status != "active":
        raise credentials_error

    new_payload = _build_token_payload(user)
    new_access = create_access_token(data=new_payload)
    new_refresh = create_refresh_token(data={"user_id": user.user_id, "email": user.email})

    logger.info(f"Tokens refreshed for user_id={user_id}")
    return {"access_token": new_access, "refresh_token": new_refresh}


@router.post("/logout")
async def logout():
    """
    Stateless JWT logout — client must discard both tokens.
    For token blacklisting, integrate Redis here in the future.
    """
    return {"message": "Logged out successfully. Please discard your tokens."}
