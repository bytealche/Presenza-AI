import cv2
import os
from datetime import datetime

from app.ai_engine.face_detection import detect_faces
from app.ai_engine.face_embedding import generate_embedding
from app.ai_engine.vector_store import add_user, EMBEDDING_DIR

def enroll_user(user_id: int, frame):
    faces = detect_faces(frame)

    if len(faces) != 1:
        raise Exception(f"Exactly one face required for enrollment. Found {len(faces)}.")

    face_data = faces[0]
    confidence = face_data.get("confidence", 0.0)
    
    # Enforce strict confidence for enrollment
    # Normal detections might accept lower, but enrollment must be high quality.
    MIN_ENROLLMENT_CONFIDENCE = 0.90 
    
    if confidence < MIN_ENROLLMENT_CONFIDENCE:
        raise Exception(f"Face quality too low (Confidence: {confidence:.2f}). Please ensure good lighting and no obstructions.")

    face_img = face_data["face_image"]
    embedding = generate_embedding(face_img)
    
    if embedding is None:
        raise Exception("Failed to generate embedding for the face.")

    print(f"DEBUG: Enrollment embedding shape: {embedding.shape}")

    filename = f"user_{user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.npy"
    path = os.path.join(EMBEDDING_DIR, filename)

    add_user(user_id, embedding, path)

    return path
