import cv2
from datetime import datetime

def detect_faces(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    detector = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )

    faces = detector.detectMultiScale(gray, 1.3, 5)
    results = []

    for (x, y, w, h) in faces:
        face_img = frame[y:y+h, x:x+w]
        results.append({
            "face_image": face_img,
            "bbox": (x, y, w, h),
            "frame_time": datetime.utcnow()
        })

    return results
