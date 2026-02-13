from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
import cv2
import numpy as np
import os
from datetime import datetime

from app.database.dependencies import get_db
from app.models.user import User
from app.core.auth_dependencies import get_current_user
from app.schemas.user_schema import UserCreate, UserResponse
from app.core.security import hash_password
from app.ai_engine.face_detection import detect_faces
from app.ai_engine.face_embedding import generate_embedding
from app.ai_engine.vector_store import find_match, add_user, EMBEDDING_DIR

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

@router.post("/register-with-face", response_model=UserResponse)
async def register_with_face(
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    org_id: int = Form(...),
    role_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    print(f"DEBUG: REGISTER FACE - Email: {repr(email)}, Password: {repr(password)}")
    # 1. Read and Decode Image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    # 2. Detect Face
    faces = detect_faces(frame)
    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected")
    
    if len(faces) > 1:
        # Sort by area (w * h) descending
        faces.sort(key=lambda f: f["bbox"][2] * f["bbox"][3], reverse=True)
        
        largest_face = faces[0]
        largest_area = largest_face["bbox"][2] * largest_face["bbox"][3]
        
        # If second largest is close in size, reject (ambiguous)
        second_face = faces[1]
        second_area = second_face["bbox"][2] * second_face["bbox"][3]
        
        if second_area > 0.5 * largest_area:
             raise HTTPException(status_code=400, detail="Multiple prominent faces detected. Please ensure only one person is in the frame.")
        
        # Else continue with largest face
        face_item = largest_face
    else:
        face_item = faces[0]

    # Use face_image directly? Or original frame?
    # generate_embedding expects image path or numpy array. 
    # If we pass crop, DeepFace aligns it (which is good).
    # If we pass frame, we rely on duplicate detection. 
    # Let's pass the crop from detect_faces.
    embedding = generate_embedding(face_item["face_image"])

    if embedding is None:
        raise HTTPException(status_code=500, detail="Failed to generate face embedding")

    # 3. Check Duplicates
    match_user_id, confidence = find_match(embedding, threshold=0.4) # Strict threshold for duplicates? Or loose?
    # DeepFace (VGG-Face) cosine similarity. 0.4 is usually distinct. 
    # vector_store uses L2 distance converted to confidence.
    # We should trust find_match logic.

    if match_user_id:
        existing_user = db.query(User).filter(User.user_id == match_user_id).first()
        if existing_user:
             raise HTTPException(status_code=400, detail="Face already registered with another account.")
    
    # Check if email exists (standard duplicate check)
    email_user = db.query(User).filter(User.email == email).first()
    if email_user:
         raise HTTPException(status_code=400, detail="Email already registered")

    # 4. Create New User
    try:
        print(f"DEBUG: Password received: '{password}' (len: {len(password)})")
        hashed_password = hash_password(password)
        new_user = User(
            full_name=full_name,
            email=email,
            password_hash=hashed_password,
            org_id=org_id,
            role_id=role_id
        )
        db.add(new_user)
        db.flush() # Get user_id

        # 5. Save Embedding
        filename = f"user_{new_user.user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.npy"
        path = os.path.join(EMBEDDING_DIR, filename)
        add_user(new_user.user_id, embedding, path)

        db.commit()
        db.refresh(new_user)
        print(f"DEBUG: SUCCESS - Created user {new_user.user_id} with email {repr(new_user.email)}")
        return new_user

    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Integrity error during registration")
    except Exception as e:
        import traceback
        traceback.print_exc()
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=list[UserResponse])
def list_users(
    role_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # Assuming imported
):
    # Only Admin
    if current_user.role_id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = db.query(User).filter(User.org_id == current_user.org_id)
    if role_id:
        query = query.filter(User.role_id == role_id)
        
    return query.all()

@router.put("/{user_id}/status")
def update_user_status(
    user_id: int,
    status: str = Body(..., embed=True), # Expects JSON { "status": "active" }
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Admin Only
    if current_user.role_id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # 2. Get User
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # 3. Security: Can only update users in SAME Org
    if user.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Cannot update user from another organization")
        
    # 4. Update
    if status not in ["active", "suspended", "pending"]:
         raise HTTPException(status_code=400, detail="Invalid status")
         
    user.status = status
    db.commit()
    return {"message": f"User status updated to {status}"}
