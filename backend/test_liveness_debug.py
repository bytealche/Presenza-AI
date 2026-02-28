import cv2
import os
import requests
import numpy as np
from app.ai_engine.face_detection import detect_faces

# Download a sample face image
img_url = "https://raw.githubusercontent.com/serengil/deepface/master/tests/dataset/img1.jpg"
img_path = "test_face.jpg"

if not os.path.exists(img_path) or os.path.getsize(img_path) < 1000:
    print("Downloading sample image...")
    headers = {'User-Agent': 'Mozilla/5.0'}
    resp = requests.get(img_url, headers=headers)
    with open(img_path, "wb") as f:
        f.write(resp.content)

print(f"Reading {img_path}...")
frame = cv2.imread(img_path)
if frame is None:
    print("Error: Failed to load image.")
    exit(1)

print(f"Reading {img_path}...")
frame = cv2.imread(img_path)

print("Running detect_faces...")
try:
    results = detect_faces(frame)
    print(f"Results: {len(results)} faces detected.")
    for i, res in enumerate(results):
        print(f"Face {i}: Real={res.get('is_real')}, Conf={res.get('confidence')}")
except Exception as e:
    print(f"Error: {e}")
