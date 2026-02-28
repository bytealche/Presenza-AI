from fastapi import APIRouter, Depends, HTTPException
from app.core.auth_dependencies import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

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
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
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
    await db.commit()
    await db.refresh(new_session)
    return new_session

@router.get("/", response_model=list[SessionResponse])
async def list_sessions(
    teacher_id: int = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Admin: All sessions for org, optionally filtered by teacher
    if current_user.role_id == 1:
        stmt = select(SessionModel).where(SessionModel.org_id == current_user.org_id)
        if teacher_id:
            stmt = stmt.where(SessionModel.created_by == teacher_id)
        result = await db.execute(stmt)
        return result.scalars().all()
    
    # Teacher: Sessions created by me
    if current_user.role_id == 2:
        result = await db.execute(select(SessionModel).where(SessionModel.created_by == current_user.user_id))
        return result.scalars().all()
        
    # Student: Sessions I am enrolled in? Or just return empty/error?
    # For now, let's return all sessions for the org so they can see schedule
    # Or strict: db.query(SessionModel).join(Enrollment).filter(Enrollment.user_id == current_user.user_id).all()
    if current_user.role_id == 3:
        # Simple: All sessions in org (Public Schedule)
         result = await db.execute(select(SessionModel).where(SessionModel.org_id == current_user.org_id))
         return result.scalars().all()
    
    return []
