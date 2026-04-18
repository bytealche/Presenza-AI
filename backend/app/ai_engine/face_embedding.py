import numpy as np
from deepface import DeepFace

def load_model():
    """
    Pre-load the Facenet512 model into memory to avoid delay on first request.
    """
    print("Pre-loading Face Recognition Model (Facenet512)...")
    try:
        # Building the model triggers download/load
        DeepFace.build_model("Facenet512")
        print("Face Recognition Model Loaded Successfully.")
    except Exception as e:
        error_msg = str(e).encode('ascii', 'ignore').decode('ascii')
        print(f"Error loading model: {error_msg}")
        print(f"Error type: {type(e)}")

def generate_embedding(face_image):
    """
    Generates a 128-dim embedding using DeepFace (VGG-Face model).
    face_image: can be a numpy array (BGR) or image path.
    """
    try:
        # data[0]["embedding"] is a list
        embedding_objs = DeepFace.represent(
            img_path=face_image,
            model_name="Facenet512",
            enforce_detection=False,
            detector_backend="skip",  # Face already cropped upstream — skip re-detection
            align=False               # Alignment requires detection landmarks; skipped for speed
        )
        
        if not embedding_objs:
            return None

        # Return the first face's embedding
        embedding = embedding_objs[0]["embedding"]
        arr = np.array(embedding, dtype="float32")
        print(f"DEBUG: Generated embedding shape: {arr.shape}")
        return arr
        
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None
