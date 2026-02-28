from fastapi import APIRouter, Depends, HTTPException, status, Body, UploadFile, File, Form, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta
import random
import string
import numpy as np
import cv2

from app.core.rate_limit import limiter

from app.database.dependencies import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.verification_code import VerificationCode
from app.models.role import Role
from app.schemas.auth_schema import LoginRequest, TokenResponse
from app.schemas.auth_schema_extended import OTPRequest, OrganizationRegisterRequest, UserRegisterRequest
from app.core.security import verify_password, create_access_token, hash_password
from app.ai_engine.face_detection import detect_faces
from app.ai_engine.liveness_detection import LivenessDetector
from app.ai_engine.face_embedding import generate_embedding
from app.ai_engine.vector_store import find_match
from app.core.email import send_email_sync

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

# --- OTP Helper ---
def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

@router.post("/send-otp")
@limiter.limit("5/minute")
async def send_otp(request: Request, data: OTPRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    # 1. Check if email already registered? 
    # Usually we allow sending OTP even if registered to reset password, but here it's for registration.
    # Let's allow it.
    
    # 2. Generate Code
    code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # 3. Store in DB
    # Invalidate previous codes
    await db.execute(delete(VerificationCode).where(VerificationCode.email == data.email))
    
    vc = VerificationCode(email=data.email, code=code, expires_at=expires_at)
    db.add(vc)
    await db.commit()
    
    # 4. Send Email (Background)
    subject = "Verify your Presenza AI Account"
    body = f"Your verification code is: {code}\n\nThis code will expire in 10 minutes."
    
    background_tasks.add_task(send_email_sync, data.email, subject, body)
    
    return {"message": "OTP sent. Please check your email (and spam folder)."}

async def verify_otp_logic(email: str, code: str, db: AsyncSession):
    result = await db.execute(
        select(VerificationCode).where(
            VerificationCode.email == email,
            VerificationCode.code == code
        )
    )
    record = result.scalars().first()
    
    if not record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if not record.is_valid():
        raise HTTPException(status_code=400, detail="OTP expired")
        
    # Delete used code
    await db.delete(record)
    await db.commit()
    return True

@router.post("/register-organization")
@limiter.limit("5/minute")
async def register_organization(request: Request, data: OrganizationRegisterRequest, db: AsyncSession = Depends(get_db)):
    print(f"DEBUG: Registering Org: {data.org_name}, {data.email}")
    try:
        # 1. Verify OTP
        await verify_otp_logic(data.email, data.otp, db)
        
        # 2. Check Email Exists
        result = await db.execute(select(User).where(User.email == data.email))
        if result.scalars().first():
            raise HTTPException(status_code=400, detail="Email already registered")
            
        # 3. Create Organization
        new_org = Organization(org_name=data.org_name, org_type="Organization")
        db.add(new_org)
        await db.flush() # Get ID
        
        # 4. Create Admin User
        hashed = hash_password(data.password)
        new_user = User(
            full_name=f"Admin - {data.org_name}",
            email=data.email,
            password_hash=hashed,
            org_id=new_org.org_id,
            role_id=1, # Admin
            status="active"
        )
        db.add(new_user)
        await db.commit()
        
        return {"message": "Organization registered successfully"}
    except Exception as e:
        print(f"ERROR in register_organization: {e}")
        import traceback
        traceback.print_exc()
        raise e

@router.post("/register-user")
@limiter.limit("5/minute")
async def register_user(request: Request, data: UserRegisterRequest, db: AsyncSession = Depends(get_db)):
    # 1. Verify OTP
    await verify_otp_logic(data.email, data.otp, db)
    
    # 2. Check Email Exists
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # 3. Determine Status
    status = "active"
    if data.role_id == 2 and data.org_id: # Faculty + Org
        status = "pending"
    
    # 4. Create User
    hashed = hash_password(data.password)
    new_user = User(
        full_name=data.full_name,
        email=data.email,
        password_hash=hashed,
        org_id=data.org_id, # Optional
        role_id=data.role_id,
        status=status
    )
    db.add(new_user)
    await db.commit()
    
    msg = "User registered successfully."
    if status == "pending":
        msg += " Waiting for organization approval."
        
    return {"message": msg}

@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, data: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
        
    if user.status != "active":
         raise HTTPException(status_code=403, detail="Account is pending approval or suspended.")

    try:
        is_valid = verify_password(data.password, user.password_hash)
    except Exception:
        is_valid = False

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(
        data={
            "user_id": user.user_id, 
            "role_id": user.role_id, 
            "org_id": user.org_id,
            "full_name": user.full_name,
            "email": user.email
        }
    )

    return {"access_token": token}

