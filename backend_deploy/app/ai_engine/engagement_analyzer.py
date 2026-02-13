import numpy as np

class EngagementAnalyzer:
    def __init__(self):
        self.history = {}

    def _face_center_score(self, bbox, frame_shape):
        x, y, w, h = bbox
        fh, fw = frame_shape[:2]

        face_cx = x + w / 2
        frame_cx = fw / 2

        offset = abs(face_cx - frame_cx) / frame_cx
        return max(0.0, 1.0 - offset)  # closer to center → higher score

    def _motion_stability_score(self, confidence):
        # confidence proxy for recognition stability
        return min(1.0, max(0.0, confidence))

    def update(self, user_id, bbox, frame_shape, confidence):
        center_score = self._face_center_score(bbox, frame_shape)
        motion_score = self._motion_stability_score(confidence)

        score = 0.6 * center_score + 0.4 * motion_score

        self.history.setdefault(user_id, []).append(score)
        return score

    def get_engagement(self, user_id, window=5):
        scores = self.history.get(user_id, [])
        if len(scores) < window:
            return None
        return sum(scores[-window:]) / window
