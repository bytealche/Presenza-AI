import cv2
import numpy as np

# --- Utility checks ---

def texture_variance(face_image):
    gray = cv2.cvtColor(face_image, cv2.COLOR_BGR2GRAY)
    return gray.var()  # photos tend to have low variance

FACE_SIZE = (112, 112)

def preprocess(face):
    face = cv2.resize(face, FACE_SIZE)
    face = cv2.cvtColor(face, cv2.COLOR_BGR2GRAY)
    return face

def motion_detect(prev_face, curr_face):
    if prev_face is None:
        return True

    prev = preprocess(prev_face)
    curr = preprocess(curr_face)

    diff = cv2.absdiff(prev, curr)
    return diff.mean() > 2.5
# --- Main liveness decision ---

class LivenessDetector:
    def __init__(self):
        self.prev_face = None

    def check(self, face_image):
        variance = texture_variance(face_image)
        motion = motion_detect(self.prev_face, face_image)

        self.prev_face = face_image.copy()

        reasons = []

        if variance < 15:
            reasons.append("low_texture_variance")

        if not motion:
            reasons.append("no_motion_detected")

        is_live = len(reasons) == 0
        return is_live, reasons
