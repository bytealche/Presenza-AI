import faiss
import numpy as np
import os

# Facenet512 outputs 512-dimensional embeddings
DIM = 512
# We use Inner Product (IP) which is equivalent to Cosine Similarity for normalized vectors
index = faiss.IndexFlatIP(DIM)
user_map = {}

EMBEDDING_DIR = os.path.join(
    os.path.dirname(__file__),
    "embeddings"
)

os.makedirs(EMBEDDING_DIR, exist_ok=True)

def normalize_vector(vector):
    """Normalize a vector to unit length (L2 norm = 1)."""
    norm = np.linalg.norm(vector)
    if norm == 0:
        return vector
    return vector / norm

def add_user(user_id, embedding, path):
    # Ensure embedding is 2D (1, DIM)
    embedding = embedding.reshape(1, -1)
    
    # Normalize for Cosine Similarity
    embedding = normalize_vector(embedding)
    
    idx = index.ntotal
    index.add(embedding)
    user_map[idx] = user_id

    np.save(path, embedding)

def load_all_embeddings():
    index.reset()
    user_map.clear()

    for file in os.listdir(EMBEDDING_DIR):
        if file.endswith(".npy"):
            try:
                # Format: user_{id}_{timestamp}.npy
                parts = file.split("_")
                if len(parts) >= 2 and parts[0] == "user":
                    user_id = int(parts[1])
                    path = os.path.join(EMBEDDING_DIR, file)
                    embedding = np.load(path)
                    
                    # Handle dimension mismatch if upgrading from old model
                    if embedding.shape[-1] != DIM: 
                        print(f"Skipping incompatible embedding {file} (dim {embedding.shape[-1]} vs {DIM})")
                        continue
                        
                    add_user(user_id, embedding, path)
            except Exception as e:
                print(f"Error loading embedding {file}: {e}")

def find_match(embedding, threshold=0.4):
    """
    Find the closest user embedding using FAISS (Cosine Similarity).
    Returns (user_id, confidence)
    """

    if index.ntotal == 0:
        return None, 0.0

    # Normalize query vector
    embedding = embedding.reshape(1, -1)
    embedding = normalize_vector(embedding)

    # FAISS search
    # distances will be cosine similarity (because vectors are normalized + IndexFlatIP)
    # Range: [-1, 1], where 1 is perfect match
    distances, indices = index.search(embedding, 1)

    similarity = float(distances[0][0])
    idx = int(indices[0][0])

    # Similarity IS the confidence in this case
    confidence = max(0.0, similarity)

    # Adjust threshold based on Facenet512 characteristics
    # Typically > 0.4 is a match, > 0.6 is strong match
    if confidence >= threshold:
        return user_map.get(idx), confidence

    return None, confidence
