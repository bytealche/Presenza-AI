import cv2
import os
import asyncio
from app.ai_engine.decision_engine import process_frame
from app.database.database import SessionLocal

# Always resolve path relative to THIS file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
image_path = os.path.join(BASE_DIR, "test_face.jpg")

frame = cv2.imread(image_path)

async def test_frame():
    if frame is None:
        raise Exception(f"Image not loaded. Check path: {image_path}")

    print("AI Decisions:")
    for i in range(8):
        async with SessionLocal() as db:
            decisions = await process_frame(db, frame)
        print(f"Frame {i+1}")
        for d in decisions:
            print("Engagement:", d.get("engagement_score"))

if __name__ == "__main__":
    asyncio.run(test_frame())
