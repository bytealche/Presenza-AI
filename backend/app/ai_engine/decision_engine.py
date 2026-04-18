from app.ai_engine.face_detection import detect_faces
from app.ai_engine.liveness_detection import LivenessDetector
from app.ai_engine.face_embedding import generate_embedding
from app.ai_engine.face_recognition import recognize_face
from app.ai_engine.adaptive_threshold import adjust_threshold
from app.ai_engine.fraud_detector import detect_fraud
from app.ai_engine.config import BASE_THRESHOLD
from app.ai_engine.presence_tracker import PresenceTracker
from sqlalchemy.ext.asyncio import AsyncSession
from app.ai_engine.engagement_analyzer import EngagementAnalyzer
liveness_detector = LivenessDetector()

engagement_analyzer = EngagementAnalyzer()
presence_tracker = PresenceTracker()
import asyncio

async def process_frame(db: AsyncSession, frame):
    decisions = []

    # 1. Detect all faces (CPU-bound, runs in thread pool)
    faces = await asyncio.to_thread(detect_faces, frame)

    if not faces:
        return decisions

    # 2. Run liveness + embedding for ALL faces in parallel
    def _analyze_face(face_image):
        live, live_reasons = liveness_detector.check(face_image)
        embedding = generate_embedding(face_image)
        return live, live_reasons, embedding

    analysis_results = await asyncio.gather(
        *[asyncio.to_thread(_analyze_face, face["face_image"]) for face in faces]
    )

    # 3. Sequential async DB work (DB sessions are not thread-safe to parallelize)
    for face, (live, live_reasons, embedding) in zip(faces, analysis_results):
        user_id, confidence = await recognize_face(db, embedding)

        engagement_score = None
        if user_id:
            engagement_score = engagement_analyzer.update(
                user_id=user_id,
                bbox=face["bbox"],
                frame_shape=frame.shape,
                confidence=confidence
            )

            presence_tracker.update(user_id, confidence, face["frame_time"])
            confirmed = presence_tracker.is_confirmed(user_id)
        else:
            confirmed = False

        threshold = adjust_threshold(BASE_THRESHOLD, confidence)
        is_fraud, reason = detect_fraud(live, confidence, threshold)

        decision = {
            "user_id": user_id,
            "confidence": confidence,
            "confirmed": confirmed,
            "is_fraud": is_fraud or not live,
            "reason": reason or ("liveness_failed" if not live else None),
            "liveness_reasons": live_reasons,
            "engagement_score": engagement_score,
            "timestamp": face["frame_time"],
            "bbox": face["bbox"]
        }

        decisions.append(decision)

    return decisions
