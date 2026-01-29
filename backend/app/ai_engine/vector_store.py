import faiss
import numpy as np
import os

DIM = 128
index = faiss.IndexFlatL2(DIM)
user_map = {}

EMBEDDING_DIR = os.path.join(
    os.path.dirname(__file__),
    "embeddings"
)

os.makedirs(EMBEDDING_DIR, exist_ok=True)

def add_user(user_id, embedding, path):
    idx = index.ntotal
    index.add(embedding.reshape(1, -1))
    user_map[idx] = user_id

    np.save(path, embedding)

def load_all_embeddings():
    index.reset()
    user_map.clear()

    for file in os.listdir(EMBEDDING_DIR):
        if file.endswith(".npy"):
            user_id = int(file.split("_")[1])
            embedding = np.load(os.path.join(EMBEDDING_DIR, file))
            add_user(user_id, embedding, os.path.join(EMBEDDING_DIR, file))
def find_match(embedding, threshold=0.8):
    """
    Find the closest user embedding using FAISS.
    Returns (user_id, confidence)
    """

    if index.ntotal == 0:
        return None, 0.0

    # FAISS search
    distances, indices = index.search(embedding.reshape(1, -1), 1)

    distance = float(distances[0][0])
    idx = int(indices[0][0])

    # Convert L2 distance → confidence score
    confidence = max(0.0, 1.0 - distance)

    if confidence >= threshold:
        return user_map.get(idx), confidence

    return None, confidence
