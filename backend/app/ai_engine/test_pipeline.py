import cv2
import os
from app.ai_engine.decision_engine import process_frame

# Always resolve path relative to THIS file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
image_path = os.path.join(BASE_DIR, "test_face.jpg")

frame = cv2.imread(image_path)

if frame is None:
    raise Exception(f"Image not loaded. Check path: {image_path}")

decisions = process_frame(frame)

print("AI Decisions:")
for i in range(8):
    decisions = process_frame(frame)
    print(f"Frame {i+1}")
    for d in decisions:
        print("Engagement:", d.get("engagement_score"))


