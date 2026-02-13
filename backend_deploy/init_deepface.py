from deepface import DeepFace
import numpy as np

print("Initializing DeepFace (VGG-Face)...")
try:
    # Trigger download
    DeepFace.build_model("VGG-Face")
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")
