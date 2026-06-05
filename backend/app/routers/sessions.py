from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from app.core.auth_dependencies import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from app.database.dependencies import get_db
from app.models.session import Session as SessionModel
from app.schemas.session_schema import SessionCreate, SessionUpdate, SessionResponse, ClassNotificationRequest, SubjectRequest
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
    # Check if there is an approved subject request for this session name in the organization
    subject_req_result = await db.execute(
        text("SELECT teacher_id, status FROM subject_requests WHERE org_id = :org_id AND subject_name = :subject_name"),
        {"org_id": current_user.org_id, "subject_name": data.session_name}
    )
    rows = subject_req_result.fetchall()
    approved_reqs = [r for r in rows if r.status == 'approved']
    if not approved_reqs:
        raise HTTPException(
            status_code=400,
            detail=f"Subject '{data.session_name}' is not approved or does not exist in the catalog."
        )
    is_requester = any(r.teacher_id == current_user.user_id for r in approved_reqs)
    if not is_requester:
        raise HTTPException(
            status_code=403,
            detail="Only the user who requested the subject can create classes under it."
        )

    new_session = SessionModel(
        org_id=current_user.org_id,
        session_name=data.session_name,
        created_by=current_user.user_id,
        camera_id=data.camera_id,
        start_time=data.start_time,
        end_time=data.end_time,
        location=data.location,
        class_type=data.class_type,
        is_approved=True  # Automatically approved on creation (no admin approval required)
    )

    db.add(new_session)
    await db.flush()

    # Auto-enroll students who are enrolled in this subject in the organization
    from app.models.enrollment import Enrollment as EnrollmentModel
    from datetime import datetime
    
    enrolled_students = await db.execute(
        text("SELECT user_id FROM subject_enrollments WHERE subject_name = :subject_name"),
        {"subject_name": new_session.session_name}
    )
    student_ids = [r[0] for r in enrolled_students.fetchall()]
    for student_id in student_ids:
        # Create enrollment for this new session
        db.add(EnrollmentModel(
            session_id=new_session.session_id,
            user_id=student_id,
            enrolled_at=datetime.utcnow()
        ))

    await db.commit()
    await db.refresh(new_session)
    return new_session

@router.patch(
    "/{session_id}",
    response_model=SessionResponse,
    dependencies=[Depends(require_roles([1, 2]))]  # admin + teacher
)
async def update_session(
    session_id: int,
    data: SessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(SessionModel).where(SessionModel.session_id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Check authorization: Admin or the Teacher who created the session
    if current_user.role_id != 1 and session.created_by != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this session")
        
    # Update only provided fields
    update_data = data.model_dump(exclude_unset=True)
    if "session_name" in update_data and update_data["session_name"] != session.session_name:
        new_name = update_data["session_name"]
        subject_req_result = await db.execute(
            text("SELECT teacher_id, status FROM subject_requests WHERE org_id = :org_id AND subject_name = :subject_name"),
            {"org_id": current_user.org_id, "subject_name": new_name}
        )
        rows = subject_req_result.fetchall()
        approved_reqs = [r for r in rows if r.status == 'approved']
        if not approved_reqs:
            raise HTTPException(
                status_code=400,
                detail=f"Subject '{new_name}' is not approved or does not exist in the catalog."
            )
        is_requester = any(r.teacher_id == current_user.user_id for r in approved_reqs)
        if not is_requester:
            raise HTTPException(
                status_code=403,
                detail="Only the user who requested the subject can create or update classes under it."
            )

    for key, value in update_data.items():
        setattr(session, key, value)
        
    await db.commit()
    await db.refresh(session)
    return session

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
    "/{session_id}/end",
    dependencies=[Depends(require_roles([1, 2]))]  # admin + teacher
)
async def end_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(SessionModel).where(SessionModel.session_id == session_id))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Check authorization
    if current_user.role_id != 1 and session.created_by != current_user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to end this session")
        
    from datetime import datetime
    import json
    import asyncio
    from app.core.websocket_manager import manager

    # Set end_time to now to mark the session as ended early
    session.end_time = datetime.utcnow()
    await db.commit()
    
    # Broadcast to websocket that the session has ended
    camera_id_str = str(session.camera_id) if session.camera_id else None
    if camera_id_str:
        payload = json.dumps({"type": "session_ended"})
        await manager.broadcast_to_receivers(camera_id_str, payload)
        await manager.send_to_sender(camera_id_str, payload)
        # Yield briefly and disconnect
        await asyncio.sleep(0.5)
        await manager.disconnect_all(camera_id_str)
        
    return {"message": "Session ended successfully"}


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


@router.get(
    "/approved-subjects",
    dependencies=[Depends(require_roles([1, 2, 3]))]  # admin + teacher + student
)
async def list_approved_subjects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        text("""
            SELECT request_id, subject_name, description
            FROM subject_requests
            WHERE org_id = :org_id AND status = 'approved'
            ORDER BY subject_name ASC
        """),
        {"org_id": current_user.org_id}
    )
    subjects_list = []
    for row in result.fetchall():
        subjects_list.append({
            "request_id": row.request_id,
            "subject_name": row.subject_name,
            "description": row.description
        })
    return subjects_list


@router.post(
    "/request-subject",
    dependencies=[Depends(require_roles([1, 2]))]  # admin + teacher
)
async def request_subject(
    data: SubjectRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch organization admin (role_id = 1)
    admin_result = await db.execute(
        select(User).where(User.org_id == current_user.org_id, User.role_id == 1)
    )
    admin = admin_result.scalars().first()
    
    # Save request to the database
    await db.execute(
        text("""
            INSERT INTO subject_requests (org_id, teacher_id, subject_name, description, status)
            VALUES (:org_id, :teacher_id, :subject_name, :description, 'pending')
        """),
        {
            "org_id": current_user.org_id,
            "teacher_id": current_user.user_id,
            "subject_name": data.subject_name,
            "description": data.description
        }
    )
    await db.commit()
    
    # If no admin, send to system default
    admin_email = admin.email if admin else "admin@presenza.ai"
    admin_name = admin.full_name if admin else "System Administrator"

    email_subject = f"[Subject Request] New Catalog Subject Request: {data.subject_name}"
    
    plain_body = f"""Hi {admin_name},

Instructor {current_user.full_name} has requested the creation of a new Subject in your organization catalog.

Subject Name: {data.subject_name}
Description: {data.description or "No description provided."}

Please log in to your Presenza AI Admin Dashboard to review and configure this subject catalog entry.

Best regards,
Team Presenza"""

    html_body = f"""
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 12px; color: #1e293b; line-height: 1.6;">
        <div style="text-align: center; margin-bottom: 25px;">
            <h1 style="color: #4f46e5; margin: 0; font-size: 28px;">Presenza AI</h1>
            <p style="color: #64748b; margin-top: 5px;">Subject Catalog Request</p>
        </div>
        
        <p style="font-size: 16px;">Hi <strong>{admin_name}</strong>,</p>
        
        <p style="font-size: 16px;">An instructor has requested a new Subject in your organization's course catalog:</p>
        
        <div style="background-color: #f8fafc; border-left: 4px solid #4f46e5; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #1e293b; font-size: 18px;">{data.subject_name}</h3>
            <p style="white-space: pre-wrap; color: #475569; font-size: 14px; margin-bottom: 0;"><strong>Description:</strong><br>{data.description or "No description provided."}</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 14px; color: #64748b;">
            <p>Requested by: <strong>{current_user.full_name}</strong> ({current_user.email})</p>
            <p>Please review and approve this entry in your Administrator settings.</p>
            <p style="margin-top: 20px;">Best regards,<br><strong style="color: #1e293b;">Team Presenza</strong></p>
        </div>
    </div>
    """

    background_tasks.add_task(
        send_email_sync,
        admin_email,
        email_subject,
        plain_body,
        html_body
    )

    return {"message": f"Subject catalog request for '{data.subject_name}' submitted successfully to your organization administrator."}


@router.get(
    "/subject-requests",
    dependencies=[Depends(require_roles([1]))]  # Admin only
)
async def list_subject_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        text("""
            SELECT sr.request_id, sr.org_id, sr.teacher_id, sr.subject_name, sr.description, sr.status, sr.created_at, u.full_name as teacher_name
            FROM subject_requests sr
            JOIN users u ON sr.teacher_id = u.user_id
            WHERE sr.org_id = :org_id
            ORDER BY sr.created_at DESC
        """),
        {"org_id": current_user.org_id}
    )
    requests_list = []
    for row in result.fetchall():
        requests_list.append({
            "request_id": row.request_id,
            "org_id": row.org_id,
            "teacher_id": row.teacher_id,
            "subject_name": row.subject_name,
            "description": row.description,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "teacher_name": row.teacher_name
        })
    return requests_list


@router.post(
    "/subject-requests/{request_id}/approve",
    dependencies=[Depends(require_roles([1]))]  # Admin only
)
async def approve_subject_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        text("SELECT org_id FROM subject_requests WHERE request_id = :request_id"),
        {"request_id": request_id}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Subject request not found")
    if row.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.execute(
        text("UPDATE subject_requests SET status = 'approved' WHERE request_id = :request_id"),
        {"request_id": request_id}
    )
    await db.commit()
    return {"message": "Subject request approved successfully"}


@router.post(
    "/subject-requests/{request_id}/reject",
    dependencies=[Depends(require_roles([1]))]  # Admin only
)
async def reject_subject_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        text("SELECT org_id FROM subject_requests WHERE request_id = :request_id"),
        {"request_id": request_id}
    )
    row = result.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Subject request not found")
    if row.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.execute(
        text("UPDATE subject_requests SET status = 'rejected' WHERE request_id = :request_id"),
        {"request_id": request_id}
    )
    await db.commit()
    return {"message": "Subject request rejected successfully"}



