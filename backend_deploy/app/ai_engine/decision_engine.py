from app.ai_engine.face_detection import detect_faces
from app.ai_engine.liveness_detection import LivenessDetector
from app.ai_engine.face_embedding import generate_embedding
from app.ai_engine.face_recognition import recognize_face
from app.ai_engine.adaptive_threshold import adjust_threshold
from app.ai_engine.fraud_detector import detect_fraud
from app.ai_engine.config import BASE_THRESHOLD
from app.ai_engine.presence_tracker import PresenceTracker
from app.ai_engine.engagement_analyzer import EngagementAnalyzer
liveness_detector = LivenessDetector()

engagement_analyzer = EngagementAnalyzer()
presence_tracker = PresenceTracker()
def process_frame(frame):
    decisions = []
    faces = detect_faces(frame)

    for face in faces:
        live, live_reasons = liveness_detector.check(face["face_image"])
        embedding = generate_embedding(face["face_image"])
        user_id, confidence = recognize_face(embedding)

        engagement_score = None
        if user_id:
            engagement_score = engagement_analyzer.update(
                user_id=user_id,
                bbox=face["bbox"],
                frame_shape=frame.shape,
                confidence=confidence
            )


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
            "timestamp": face["frame_time"]
        }



        decisions.append(decision)

    return decisions
