from fastapi import APIRouter, Depends, HTTPException
from app.core.auth_dependencies import get_current_user
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.session import Session as SessionModel
from app.schemas.session_schema import SessionCreate, SessionResponse
from app.core.role_dependencies import require_roles
from app.models.user import User

router = APIRouter(
    prefix="/sessions",
    tags=["Sessions"]
)

@router.post(
    "/",
    response_model=SessionResponse,
    dependencies=[Depends(require_roles([2]))]  # teacher
)
def create_session(
    data: SessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends()
):
    new_session = SessionModel(
        org_id=current_user.org_id,
        session_name=data.session_name,
        created_by=current_user.user_id,
        camera_id=data.camera_id,
        start_time=data.start_time,
        end_time=data.end_time,
        location=data.location
    )

    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.get("/", response_model=list[SessionResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Admin: All sessions for org
    if current_user.role_id == 1:
        return db.query(SessionModel).filter(SessionModel.org_id == current_user.org_id).all()
    
    # Teacher: Sessions created by me
    if current_user.role_id == 2:
        return db.query(SessionModel).filter(SessionModel.created_by == current_user.user_id).all()
        
    # Student: Sessions I am enrolled in? Or just return empty/error?
    # For now, let's return all sessions for the org so they can see schedule
    # Or strict: db.query(SessionModel).join(Enrollment).filter(Enrollment.user_id == current_user.user_id).all()
    if current_user.role_id == 3:
        # Simple: All sessions in org (Public Schedule)
         return db.query(SessionModel).filter(SessionModel.org_id == current_user.org_id).all()
    
    return []
