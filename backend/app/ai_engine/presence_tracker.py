from collections import defaultdict
from datetime import datetime, timedelta

# ── Tuning knobs ──────────────────────────────────────────────────────────────
# PRESENCE_WINDOW: how many consecutive detections before we call it "confirmed"
# At 5 fps analysis rate → 2 frames = ~0.4 s to confirm. Safe against single-
# frame noise but fast enough to feel instant.
PRESENCE_WINDOW = 2

# MIN_CONFIDENCE: average cosine-similarity score needed across those frames.
# 0.65 means the face must be clearly yours, but we don't demand perfect lighting.
MIN_CONFIDENCE = 0.65

# TIME_LIMIT: old evidence expires after this many seconds.
TIME_LIMIT = timedelta(seconds=8)


class PresenceTracker:
    def __init__(self):
        self.buffer: dict[int, list] = defaultdict(list)
        # Cache confirmed users so we never re-check them
        self._confirmed_cache: set[int] = set()

    def update(self, user_id: int, confidence: float, timestamp: datetime):
        if user_id in self._confirmed_cache:
            return   # already confirmed — no need to keep buffering
        self.buffer[user_id].append((confidence, timestamp))
        self._cleanup(user_id)

    def _cleanup(self, user_id: int):
        now = datetime.utcnow()
        self.buffer[user_id] = [
            (c, t) for c, t in self.buffer[user_id]
            if now - t <= TIME_LIMIT
        ]

    def is_confirmed(self, user_id: int) -> bool:
        if user_id in self._confirmed_cache:
            return True  # fast-path: already confirmed in a previous frame

        entries = self.buffer.get(user_id, [])
        if len(entries) < PRESENCE_WINDOW:
            return False

        avg_conf = sum(c for c, _ in entries) / len(entries)
        if avg_conf >= MIN_CONFIDENCE:
            self._confirmed_cache.add(user_id)   # never re-check this user
            self.buffer.pop(user_id, None)        # free memory
            return True
        return False

    def reset(self, user_id: int):
        self.buffer.pop(user_id, None)
        self._confirmed_cache.discard(user_id)

    def reset_all(self):
        """Call at session end to reset state for new class."""
        self.buffer.clear()
        self._confirmed_cache.clear()
