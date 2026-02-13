from collections import defaultdict
from datetime import datetime, timedelta

PRESENCE_WINDOW = 5          # frames
MIN_CONFIDENCE = 0.75
TIME_LIMIT = timedelta(seconds=15)

class PresenceTracker:
    def __init__(self):
        self.buffer = defaultdict(list)

    def update(self, user_id, confidence, timestamp):
        self.buffer[user_id].append((confidence, timestamp))
        self._cleanup(user_id)

    def _cleanup(self, user_id):
        now = datetime.utcnow()
        self.buffer[user_id] = [
            (c, t) for c, t in self.buffer[user_id]
            if now - t <= TIME_LIMIT
        ]

    def is_confirmed(self, user_id):
        entries = self.buffer.get(user_id, [])
        if len(entries) < PRESENCE_WINDOW:
            return False

        avg_conf = sum(c for c, _ in entries) / len(entries)
        return avg_conf >= MIN_CONFIDENCE

    def reset(self, user_id):
        self.buffer.pop(user_id, None)
