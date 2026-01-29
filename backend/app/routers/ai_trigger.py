from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import cv2

from app.database.dependencies import get_db
from app.core.role_dependencies import require_roles
from app.ai_engine.decision_engine import process_frame
from app.ai_engine.attendance_bridge import apply_ai_decisions

router = APIRouter(
    prefix="/ai",
    tags=["AI Engine"]
)

@router.post(
    "/run/{session_id}",
    dependencies=[Depends(require_roles([1, 2]))]  # admin or teacher
)
def run_ai_for_session(
    session_id: int,
    db: Session = Depends(get_db)
):
    cap = cv2.VideoCapture(0)
    ret, frame = cap.read()
    cap.release()

    if not ret:
        return {"error": "Camera not accessible"}

    decisions = process_frame(frame)
    results = apply_ai_decisions(db, session_id, decisions)

    return {
        "decisions": decisions,
        "attendance_saved": len(results)
    }
