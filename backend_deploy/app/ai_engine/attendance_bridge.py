from sqlalchemy.orm import Session
from app.services.attendance_service import record_attendance

def apply_ai_decisions(db, session_id, decisions):
    results = []

    for d in decisions:
        if not d.get("confirmed"):
            continue

        user_id = d["user_id"]
        confidence = d["confidence"]
        is_fraud = d["is_fraud"]

        status = "present" if not is_fraud else "fraud"

        attendance = record_attendance(
            db=db,
            session_id=session_id,
            user_id=user_id,
            final_status=status,
            final_score=confidence
        )
        results.append(attendance)

    return results
