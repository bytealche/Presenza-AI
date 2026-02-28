import os
import numpy as np
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.face_profile import FaceProfile

# Directory where local .npy embedding files are stored (used by enrollment legacy path)
EMBEDDING_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "embeddings")
os.makedirs(EMBEDDING_DIR, exist_ok=True)

def normalize_vector(vector):
    """Normalize a vector to unit length (L2 norm = 1)."""
    norm = np.linalg.norm(vector)
    if norm == 0:
        return vector
    return vector / norm

async def find_match(db: AsyncSession, embedding, threshold=0.5):
    """
    Find the closest user embedding using pgvector (Cosine Similarity).
    Returns (user_id, confidence)
    """
    # Normalize query vector
    embedding = embedding.reshape(1, -1)
    embedding = normalize_vector(embedding)
    embedding_list = embedding.flatten().tolist()

    stmt = (
        select(FaceProfile, FaceProfile.embedding.cosine_distance(embedding_list).label("distance"))
        .order_by(FaceProfile.embedding.cosine_distance(embedding_list))
        .limit(1)
    )
    
    result = await db.execute(stmt)
    row = result.first()
    
    if not row:
        return None, 0.0
        
    profile, distance = row
    similarity = 1.0 - distance
    
    confidence = max(0.0, similarity)
    
    if confidence >= threshold:
        return profile.user_id, confidence
        
    return None, confidence


def add_user(user_id: int, embedding: np.ndarray, path: str) -> None:
    """
    Save a user's face embedding as a .npy file to the given path.
    Called by enrollment.py when enrolling via the /ai/enroll endpoint.
    """
    os.makedirs(os.path.dirname(path), exist_ok=True)
    np.save(path, embedding)
    print(f"DEBUG: Saved embedding for user {user_id} to {path}")
