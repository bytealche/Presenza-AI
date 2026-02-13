import cv2
from datetime import datetime
from deepface import DeepFace
import numpy as np

def detect_faces(frame):
    """
    Detects faces using DeepFace (opencv backend by default).
    Returns a list of dicts with face_image (BGR uint8), bbox, and frame_time.
    """
    try:
        # DeepFace expects RGB if we pass numpy array? 
        # Actually DeepFace.extract_faces handles it, but let's be safe.
        # We rely on extraction to find bboxes, then crop manually to ensure format.
        
        # We use detector_backend='opencv' (Haar) or 'ssd'/'mtcnn' for better accuracy.
        # 'opencv' is fast (Haar). 'retinaface' is best but slow.
        # Switching to 'mtcnn' as 'opencv' failed to detect face in test image.
        
        if frame.shape[0] > 1000:
             scale = 1000 / frame.shape[0]
             frame_small = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
        else:
             frame_small = frame

        print(f"Detecting faces in frame of shape {frame_small.shape}")
        
        # DeepFace.extract_faces returns a list of dicts
        # Each dict has keys: "face", "facial_area", "confidence"
        face_objs = DeepFace.extract_faces(
            img_path=frame_small,
            detector_backend="mtcnn", # Improved detection. Could verify if 'retinaface' is faster/better.
            enforce_detection=False,
            align=False
        )
        print(f"DeepFace found: {len(face_objs)} faces/candidates")
        
        results = []
        for face_obj in face_objs:
            # face_obj['face'] is the aligned/normalized face. We ignore it.
            # face_obj['facial_area'] has keys 'x', 'y', 'w', 'h'
            area = face_obj['facial_area']
            x, y, w, h = area['x'], area['y'], area['w'], area['h']
            confidence = face_obj.get('confidence', 0.0)

            # Crop from resized frame (since coordinates are from detection on resized frame)
            face_img = frame_small[y:y+h, x:x+w]
            
            # Skip empty crops (if any)
            if face_img.size == 0:
                continue

            results.append({
                "face_image": face_img,
                "bbox": (x, y, w, h), # Note: coordinates are relative to resized frame
                "confidence": confidence,
                "frame_time": datetime.utcnow()
            })
            
        return results

    except Exception as e:
        print(f"Error in face detection: {e}")
        return []
