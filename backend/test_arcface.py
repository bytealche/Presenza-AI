from deepface import DeepFace
import time

print("Testing ArcFace loading...")
start = time.time()
try:
    DeepFace.build_model("ArcFace")
    print(f"Success! Model loaded in {time.time() - start:.2f}s")
except Exception as e:
    print(f"Failed: {e}")
