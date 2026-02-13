from fastapi import APIRouter, Depends, HTTPException, status, Body, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import random
import string
import numpy as np
import cv2

from app.database.dependencies import get_db
from app.models.user import User
from app.models.organization import Organization
from app.models.verification_code import VerificationCode
from app.models.role import Role
from app.schemas.auth_schema import LoginRequest, TokenResponse
from app.schemas.auth_schema_extended import OTPRequest, OrganizationRegisterRequest, UserRegisterRequest
from app.core.security import verify_password, create_access_token, hash_password
from app.ai_engine.face_detection import detect_faces
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
def send_otp(request: OTPRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # 1. Check if email already registered? 
    # Usually we allow sending OTP even if registered to reset password, but here it's for registration.
    # Let's allow it.
    
    # 2. Generate Code
    code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # 3. Store in DB
    # Invalidate previous codes
    db.query(VerificationCode).filter(VerificationCode.email == request.email).delete()
    
    vc = VerificationCode(email=request.email, code=code, expires_at=expires_at)
    db.add(vc)
    db.commit()
    
    # 4. Send Email (Background)
    subject = "Verify your Presenza AI Account"
    body = f"Your verification code is: {code}\n\nThis code will expire in 10 minutes."
    
    background_tasks.add_task(send_email_sync, request.email, subject, body)
    
    return {"message": "OTP sent. Please check your email (and spam folder)."}

def verify_otp_logic(email: str, code: str, db: Session):
    record = db.query(VerificationCode).filter(
        VerificationCode.email == email,
        VerificationCode.code == code
    ).first()
    
    if not record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if not record.is_valid():
        raise HTTPException(status_code=400, detail="OTP expired")
        
    # Delete used code
    db.delete(record)
    db.commit()
    return True

@router.post("/register-organization")
def register_organization(data: OrganizationRegisterRequest, db: Session = Depends(get_db)):
    print(f"DEBUG: Registering Org: {data.org_name}, {data.email}")
    try:
        # 1. Verify OTP
        verify_otp_logic(data.email, data.otp, db)
        
        # 2. Check Email Exists
        if db.query(User).filter(User.email == data.email).first():
            raise HTTPException(status_code=400, detail="Email already registered")
            
        # 3. Create Organization
        new_org = Organization(org_name=data.org_name, org_type="Organization")
        db.add(new_org)
        db.flush() # Get ID
        
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
        db.commit()
        
        return {"message": "Organization registered successfully"}
    except Exception as e:
        print(f"ERROR in register_organization: {e}")
        import traceback
        traceback.print_exc()
        raise e

@router.post("/register-user")
def register_user(data: UserRegisterRequest, db: Session = Depends(get_db)):
    # 1. Verify OTP
    verify_otp_logic(data.email, data.otp, db)
    
    # 2. Check Email Exists
    if db.query(User).filter(User.email == data.email).first():
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
    db.commit()
    
    msg = "User registered successfully."
    if status == "pending":
        msg += " Waiting for organization approval."
        
    return {"message": msg}

@router.post("/login-with-face", response_model=TokenResponse)
async def login_with_face(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 1. Read Image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # 2. Detect Face
    faces = detect_faces(frame)
    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected")
    
    # Use largest face
    faces.sort(key=lambda f: f["bbox"][2] * f["bbox"][3], reverse=True)
    face_item = faces[0]

    # 3. Generate Embedding
    embedding = generate_embedding(face_item["face_image"])
    if embedding is None:
        raise HTTPException(status_code=500, detail="Failed to generate embedding")

    # 4. Match User
    match_user_id, confidence = find_match(embedding, threshold=0.4)
    if not match_user_id:
        raise HTTPException(status_code=401, detail="Face not recognized")

    user = db.query(User).filter(User.user_id == match_user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # 5. Check Role Restriction (Faculty=2, Student=3)
    if user.role_id not in [2, 3]:
        raise HTTPException(status_code=403, detail="Face login not allowed for this role")

    if user.status != "active":
         raise HTTPException(status_code=403, detail="Account is pending approval or suspended.")

    token = create_access_token(
        data={"user_id": user.user_id, "role_id": user.role_id, "org_id": user.org_id}
    )

    return {"access_token": token}


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()

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
        data={"user_id": user.user_id, "role_id": user.role_id, "org_id": user.org_id}
    )

    return {"access_token": token}

