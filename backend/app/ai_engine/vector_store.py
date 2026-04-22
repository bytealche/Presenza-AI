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


async def update_user_embedding_incremental(db: AsyncSession, user_id: int, new_embedding: np.ndarray, weight: float = 0.1):
    """
    Incremental Learning: Averages the new embedding into the existing stored embedding.
    weight 0.1 means the new embedding contributes 10%, the old contributes 90%.
    """
    # Force new embedding into a 1D array of shape (512,) since pgvector expects a flat list
    new_embedding_flat = new_embedding.flatten()
    new_embedding_norm = normalize_vector(new_embedding_flat)
    
    # fetch existing embedding from DB
    result = await db.execute(select(FaceProfile).where(FaceProfile.user_id == user_id))
    profile = result.scalars().first()
    
    if profile and profile.embedding:
        existing_embedding = np.array(profile.embedding)
        
        # Calculate new average
        averaged_embedding = (existing_embedding * (1.0 - weight)) + (new_embedding_norm * weight)
        averaged_embedding = normalize_vector(averaged_embedding)
        
        # update DB
        profile.embedding = averaged_embedding.tolist()
        db.add(profile)
        try:
            await db.commit()
            print(f"DEBUG: Incrementally updated embedding for user {user_id} (weight={weight})")
        except Exception as e:
            await db.rollback()
            print(f"DEBUG: Error incrementally updating embedding for user {user_id}: {e}")
