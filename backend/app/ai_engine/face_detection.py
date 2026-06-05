import cv2
from datetime import datetime
from deepface import DeepFace
import numpy as np

def detect_faces(frame):
    """
    Detects faces using DeepFace with YuNet backend (and fallback to opencv/Haar backend).
    Returns a list of dicts with face_image (BGR uint8, raw crop), aligned_face (BGR uint8, aligned crop),
    bbox, confidence, is_real, and frame_time.
    """
    try:
        if frame.shape[0] > 640:
             scale = 640 / frame.shape[0]
             frame_small = cv2.resize(frame, (0, 0), fx=scale, fy=scale)
        else:
             frame_small = frame

        print(f"Detecting faces in frame of shape {frame_small.shape}")
        
        # Try YuNet first for better accuracy
        try:
            face_objs = DeepFace.extract_faces(
                img_path=frame_small,
                detector_backend="yunet",
                enforce_detection=False,
                align=True,
                anti_spoofing=False
            )
            print("Successfully extracted faces using YuNet")
        except Exception as e:
            error_msg = str(e).encode('ascii', 'ignore').decode('ascii')
            print(f"YuNet face detection failed/not available: {error_msg}. Falling back to OpenCV.")
            face_objs = DeepFace.extract_faces(
                img_path=frame_small,
                detector_backend="opencv",
                enforce_detection=False,
                align=True,
                anti_spoofing=False
            )
            print("Successfully extracted faces using OpenCV (Haar)")

        print(f"DeepFace found: {len(face_objs)} faces/candidates")
        
        results = []
        for face_obj in face_objs:
            # face_obj['facial_area'] has keys 'x', 'y', 'w', 'h'
            area = face_obj['facial_area']
            x, y, w, h = area['x'], area['y'], area['w'], area['h']
            confidence = face_obj.get('confidence', 0.0)
            is_real = face_obj.get('is_real', True) # Default to True if not returned
            antispoof = face_obj.get('antispoof_score')
            print(f"DEBUG: Face {x},{y} - Confidence: {confidence:.2f}, Is Real: {is_real}, Score: {antispoof}")

            # Crop raw unaligned face from resized frame for liveness check
            face_img = frame_small[y:y+h, x:x+w]
            
            # Skip empty crops (if any)
            if face_img.size == 0:
                continue

            # Convert aligned face RGB float32 [0.0, 1.0] returned by DeepFace to BGR uint8
            aligned_face_rgb = face_obj['face']
            if aligned_face_rgb is not None and aligned_face_rgb.size > 0:
                aligned_face_bgr = cv2.cvtColor((aligned_face_rgb * 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
            else:
                aligned_face_bgr = face_img

            results.append({
                "face_image": face_img,         # Raw unaligned BGR uint8 crop (for liveness)
                "aligned_face": aligned_face_bgr, # Aligned BGR uint8 crop (for embedding)
                "bbox": (x, y, w, h),
                "confidence": confidence,
                "is_real": is_real,
                "frame_time": datetime.utcnow()
            })
            
        return results

    except Exception as e:
        error_msg = str(e).encode('ascii', 'ignore').decode('ascii')
        print(f"Error in face detection: {error_msg}")
        return []
