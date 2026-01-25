import faiss
import numpy as np

EMBEDDING_DIM = 128
index = faiss.IndexFlatL2(EMBEDDING_DIM)

def add_embedding(vector):
    vector = np.array(vector).astype("float32").reshape(1, -1)
    index.add(vector)
    return index.ntotal - 1

def search_embedding(vector):
    vector = np.array(vector).astype("float32").reshape(1, -1)
    D, I = index.search(vector, 1)
    return I[0][0], D[0][0]
