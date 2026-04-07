from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Body, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
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
from app.ai_engine.liveness_detection import LivenessDetector
from app.ai_engine.face_embedding import generate_embedding, load_model
from app.ai_engine.vector_store import find_match
from app.models.face_profile import FaceProfile
from app.core.supabase_client import supabase

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

@router.post("/", response_model=UserResponse)
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
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
        await db.commit()
        await db.refresh(new_user)

        return new_user  # ✅ ALWAYS return on success

    except IntegrityError:
        await db.rollback()
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
    background_tasks: BackgroundTasks,
    full_name: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    org_id: int = Form(...),
    role_id: int = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    print(f"DEBUG: REGISTER FACE - Email: {repr(email)}, Password: {repr(password)}")
    
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
    if len(password) > 64:
        raise HTTPException(status_code=400, detail="Password cannot exceed 64 characters")

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

    # Anti-spoofing check using standalone LivenessDetector
    liveness_detector = LivenessDetector()
    is_live, reasons = liveness_detector.check(face_item["face_image"])
    
    if not is_live:
        print(f"DEBUG: Spoofing rejected during registration: {reasons}")
        raise HTTPException(status_code=400, detail=f"Face validation failed. Please use a real live camera feed. (Reason: {reasons[0]})")

    # Use face_image directly? Or original frame?
    # generate_embedding expects image path or numpy array. 
    # If we pass crop, DeepFace aligns it (which is good).
    # If we pass frame, we rely on duplicate detection. 
    # Let's pass the crop from detect_faces.
    embedding = generate_embedding(face_item["face_image"])

    if embedding is None:
        raise HTTPException(status_code=500, detail="Failed to generate face embedding")

    # 3. Check Duplicates
    match_user_id, confidence = await find_match(db, embedding, threshold=0.5) # ArcFace threshold
    # DeepFace (VGG-Face) cosine similarity. 0.4 is usually distinct. 
    # vector_store uses L2 distance converted to confidence.
    # We should trust find_match logic.

    if match_user_id:
        result = await db.execute(select(User).where(User.user_id == match_user_id))
        existing_user = result.scalars().first()
        if existing_user:
             raise HTTPException(status_code=400, detail="Face already registered with another account.")
    
    # Check if email exists (standard duplicate check)
    result = await db.execute(select(User).where(User.email == email))
    email_user = result.scalars().first()
    if email_user:
         raise HTTPException(status_code=400, detail="Email already registered")

    # 4. Create New User
    try:
        print(f"DEBUG: Password received: '{password}' (len: {len(password)})")
        
        # Double check byte length before hashing to be safe
        if len(password.encode('utf-8')) > 72:
             raise HTTPException(status_code=400, detail="Password too long (bytes)")

        hashed_password = hash_password(password)
        
        new_user = User(
            full_name=full_name,
            email=email,
            password_hash=hashed_password,
            org_id=org_id,
            role_id=role_id
        )
        db.add(new_user)
        await db.flush() # Get user_id

        # 5. Save Embedding to Postgres using pgvector
        image_url = None
        if supabase:
            try:
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                filename = f"user_{new_user.user_id}_{timestamp}.jpg"
                res = supabase.storage.from_("profiles").upload(filename, contents, {"content-type": "image/jpeg"})
                image_url = supabase.storage.from_("profiles").get_public_url(filename)
                print(f"DEBUG: Uploaded face profile image to Supabase: {image_url}")
            except Exception as e:
                print(f"ERROR: Failed to upload image to Supabase: {e}")

        face_profile = FaceProfile(
            user_id=new_user.user_id,
            embedding=embedding.flatten().tolist(),
            image_url=image_url
        )
        db.add(face_profile)

        await db.commit()
        await db.refresh(new_user)
        print(f"DEBUG: SUCCESS - Created user {new_user.user_id} with email {repr(new_user.email)}")
        return new_user

    except ValueError as e:
        # Catch errors from hash_password or other value errors
        await db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
        
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Integrity error during registration")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

import tempfile
import uuid

@router.post("/register-video-profile")
async def register_video_profile(
    user_id: int = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # This can be called by Admin or the User themselves
    if current_user.role_id != 1 and current_user.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this user's face profile")

    # Verify user exists
    result = await db.execute(select(User).where(User.user_id == user_id))
    target_user = result.scalars().first()
    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    # 1. Save video temporarily to disk (OpenCV VideoCapture needs a real file)
    temp_filename = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4().hex}.webm")
    try:
        with open(temp_filename, "wb") as f:
            f.write(await file.read())
            
        # 2. Extract frames
        cap = cv2.VideoCapture(temp_filename)
        frames = []
        count = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            # Take every 3rd frame to get variety over the 5-10 second clip (assuming 30fps -> 10fps or so)
            if count % 3 == 0:
                frames.append(frame)
            count += 1
        cap.release()
        
        if len(frames) == 0:
            raise HTTPException(status_code=400, detail="Could not extract any frames from the video. Ensure it is a valid webm file.")
            
        # Cap to a reasonable max number of frames to process so we don't blow up memory/time
        max_frames = 30
        if len(frames) > max_frames:
            # Sample evenly
            indices = np.linspace(0, len(frames) - 1, max_frames, dtype=int)
            frames = [frames[i] for i in indices]
            
        # 3. Process frames and get embeddings
        embeddings = []
        liveness_detector = LivenessDetector()
        best_face_img = None
        largest_area = 0
        
        for frame in frames:
            faces = detect_faces(frame)
            if len(faces) != 1:
                continue # Skip frames with 0 or multiple faces to avoid noise
                
            face_item = faces[0]
            
            # Anti-spoof check
            is_live, _ = liveness_detector.check(face_item["face_image"])
            if not is_live:
                continue # Skip spoofed looking frames
                
            embedding = generate_embedding(face_item["face_image"])
            if embedding is not None:
                embeddings.append(embedding.flatten())
                
                # Save the highest res face for the profile picture
                area = face_item["bbox"][2] * face_item["bbox"][3]
                if area > largest_area:
                    largest_area = area
                    best_face_img = face_item["face_image"]
                    
        if len(embeddings) < 3: # Require at least 3 high quality frames
            raise HTTPException(status_code=400, detail="Video rejected: Could not extract enough high-quality facial frames. Please ensure good lighting and only one face in the frame.")
            
        print(f"DEBUG: Successfully processed {len(embeddings)} pristine frames from video.")
        
        # 4. Math: Average the embeddings to create a master 3D-like map
        avg_embedding = np.mean(embeddings, axis=0)
        # Re-normalize just to be safe
        avg_embedding = avg_embedding / np.linalg.norm(avg_embedding)
        
        # 5. Check Duplicates (against other users)
        match_user_id, confidence = await find_match(db, avg_embedding, threshold=0.5)
        if match_user_id and match_user_id != user_id:
             raise HTTPException(status_code=400, detail=f"Face already registered with another account (User ID: {match_user_id}).")
             
        # 6. Upload Best Image to Supabase
        image_url = None
        if supabase and best_face_img is not None:
            try:
                # Convert BGR back to RGB/JPEG
                _, buffer = cv2.imencode('.jpg', best_face_img)
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                filename = f"user_{target_user.user_id}_{timestamp}.jpg"
                
                supabase.storage.from_("profiles").upload(filename, buffer.tobytes(), {"content-type": "image/jpeg"})
                image_url = supabase.storage.from_("profiles").get_public_url(filename)
            except Exception as e:
                print(f"ERROR: Failed to upload Face to Supabase: {e}")

        # 7. Save to DB
        result = await db.execute(select(FaceProfile).where(FaceProfile.user_id == target_user.user_id))
        existing_profile = result.scalars().first()
        
        if existing_profile:
            existing_profile.embedding = avg_embedding.tolist()
            if image_url:
                existing_profile.image_url = image_url
            db.add(existing_profile)
        else:
            face_profile = FaceProfile(
                user_id=target_user.user_id,
                embedding=avg_embedding.tolist(),
                image_url=image_url
            )
            db.add(face_profile)
            
        await db.commit()
        
        return {"message": "Video face profile registered successfully!", "frames_analyzed": len(embeddings)}

    finally:
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

@router.get("/", response_model=list[UserResponse])
async def list_users(
    role_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) # Assuming imported
):
    # Only Admin
    if current_user.role_id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    stmt = select(User).where(User.org_id == current_user.org_id)
    if role_id:
        stmt = stmt.where(User.role_id == role_id)
        
    result = await db.execute(stmt)
    return result.scalars().all()

@router.put("/{user_id}/status")
async def update_user_status(
    user_id: int,
    status: str = Body(..., embed=True), # Expects JSON { "status": "active" }
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Admin Only
    if current_user.role_id != 1:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # 2. Get User
    result = await db.execute(select(User).where(User.user_id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # 3. Security: Can only update users in SAME Org
    if user.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Cannot update user from another organization")
        
    # 4. Update
    if status not in ["active", "suspended", "pending"]:
         raise HTTPException(status_code=400, detail="Invalid status")
         
    user.status = status
    await db.commit()
    return {"message": f"User status updated to {status}"}
