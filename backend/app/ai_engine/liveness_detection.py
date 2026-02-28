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
        
        # In a single-shot API request (like login/register from NextJS taking a screenshot),
        # motion detection cannot work reliably between requests. 
        # We will heavily rely on texture variance (printed photos have very low variance vs real faces).
        # A more advanced model like MiniVison FasNet would go here in the future if purely 2D image is used.
        
        reasons = []

        if variance < 15:
            reasons.append("low_texture_variance_possible_photo")

        # Let's increase tolerance for the single shot, 
        # DeepFace used to reject things constantly, we want to allow reasonable faces.
        is_live = len(reasons) == 0
        return is_live, reasons
