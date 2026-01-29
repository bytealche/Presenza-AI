import cv2
import os
from datetime import datetime

from app.ai_engine.face_detection import detect_faces
from app.ai_engine.face_embedding import generate_embedding
from app.ai_engine.vector_store import add_user, EMBEDDING_DIR

def enroll_user(user_id: int, frame):
    faces = detect_faces(frame)

    if len(faces) != 1:
        raise Exception("Exactly one face required for enrollment")

    face_img = faces[0]["face_image"]
    embedding = generate_embedding(face_img)

    filename = f"user_{user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.npy"
    path = os.path.join(EMBEDDING_DIR, filename)

    add_user(user_id, embedding, path)

    return path
