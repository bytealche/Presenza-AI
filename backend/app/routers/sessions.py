from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.core.auth_dependencies import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.dependencies import get_db
from app.models.session import Session as SessionModel
from app.schemas.session_schema import SessionCreate, SessionResponse, ClassNotificationRequest
from app.core.role_dependencies import require_roles
from app.models.user import User
from app.models.enrollment import Enrollment
from app.core.email import send_email_sync

router = APIRouter(
    prefix="/sessions",
    tags=["Sessions"]
)

@router.post(
    "",
    response_model=SessionResponse,
    dependencies=[Depends(require_roles([1, 2]))]  # admin + teacher
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
        location=data.location,
        class_type=data.class_type,
        is_approved=(current_user.role_id == 1)  # Automatically approved if created by Admin
    )

    db.add(new_session)
    await db.flush()
    await db.commit()
    await db.refresh(new_session)
    return new_session

@router.get("", response_model=list[SessionResponse])
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
        # Students: Only see APPROVED sessions in their organization
        result = await db.execute(
            select(SessionModel).where(
                SessionModel.org_id == current_user.org_id,
                SessionModel.is_approved == True
            )
        )
        return result.scalars().all()
    
    return []

@router.post(
    "/{session_id}/approve",
    dependencies=[Depends(require_roles([1]))]  # Admin only
)
async def approve_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SessionModel).where(SessionModel.session_id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session.is_approved = True
    await db.commit()
    return {"message": "Session approved successfully"}

@router.post(
    "/{session_id}/reject",
    dependencies=[Depends(require_roles([1]))]  # Admin only
)
async def reject_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(SessionModel).where(SessionModel.session_id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.delete(session)
    await db.commit()
    return {"message": "Session rejected and removed successfully"}


@router.post(
    "/{session_id}/notify",
    dependencies=[Depends(require_roles([1, 2]))]  # admin + teacher
)
async def notify_online_class(
    session_id: int,
    data: ClassNotificationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(SessionModel).where(SessionModel.session_id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.class_type != "online":
        raise HTTPException(
            status_code=400,
            detail="Notifications can only be sent for online classes"
        )

    # Fetch all students (role_id=3) enrolled in this session
    students_query = await db.execute(
        select(User)
        .join(Enrollment, Enrollment.user_id == User.user_id)
        .where(Enrollment.session_id == session_id)
        .where(User.role_id == 3)
    )
    students = students_query.scalars().all()

    if not students:
        return {"message": "No students are currently enrolled in this class."}

    # Queue notification emails in the background
    for student in students:
        email_subject = f"[{session.session_name}] {data.subject}"
        plain_body = f"Hi {student.full_name},\n\nNew announcement for {session.session_name}:\n\n{data.message}\n\nBest regards,\n{current_user.full_name}\nTeam Presenza"
        
        html_body = f"""
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b; line-height: 1.6;">
            <div style="text-align: center; margin-bottom: 25px;">
                <h1 style="color: #4f46e5; margin: 0; font-size: 28px;">Presenza AI</h1>
                <p style="color: #64748b; margin-top: 5px;">Online Class Notification</p>
            </div>
            <p style="font-size: 16px;">Hi <strong>{student.full_name}</strong>,</p>
            <p style="font-size: 16px;">You have a new update for your enrolled subject: <strong style="color: #4f46e5;">{session.session_name}</strong></p>
            <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="margin-top: 0; color: #1e293b;">{data.subject}</h3>
                <p style="white-space: pre-wrap; color: #334155; margin-bottom: 0;">{data.message}</p>
            </div>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">
                <p>Sent by Instructor: <strong>{current_user.full_name}</strong></p>
                <p>Need help? Feel free to reach out to the support team or your class instructor.</p>
                <p style="margin-top: 20px;">Best regards,<br><strong style="color: #1e293b;">Team Presenza</strong></p>
            </div>
        </div>
        """
        background_tasks.add_task(
            send_email_sync, 
            student.email, 
            email_subject, 
            plain_body, 
            html_body
        )

    return {"message": f"Notifications queued successfully for {len(students)} student(s)."}


