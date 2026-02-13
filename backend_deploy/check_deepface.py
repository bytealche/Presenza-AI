from deepface import DeepFace
import cv2
import numpy as np

# Create a dummy image (black) just to see if it even runs or check object structure
# Actually, passing a black image won't detect faces.
# Let's try to pass a dummy image that might not have a face, or just inspect the function signature/doc?
# Better: Just check what `extract_faces` returns for a known face image if possible?
# But I don't have one handy.
# I will just write a script that attempts to detect from a dummy image and prints error or success.
# Or better: check attributes of a mock object if I can mock deepface? No.

# Let's trust documentation or common knowledge about DeepFace.
# DeepFace.extract_faces returns list of dicts.
# Items: 'face', 'facial_area', 'confidence' (in recent versions).

print("DeepFace version:", DeepFace.__version__)
try:
    # Just creating a dummy image with noise might trigger something?
    img = np.random.randint(0, 255, (100, 100, 3), dtype=np.uint8)
    # result = DeepFace.extract_faces(img, detector_backend="opencv", enforce_detection=False)
    # print(result)
except Exception as e:
    print(e)
