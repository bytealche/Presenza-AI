from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import List
from datetime import datetime

from app.database.dependencies import get_db
from app.models.camera import CameraDevice
from app.schemas.camera_schema import CameraCreate, CameraResponse
from app.core.auth_dependencies import get_current_user
from app.models.user import User
from app.models.session import Session as SessionModel
from app.core.websocket_manager import manager

router = APIRouter(
    prefix="/cameras",
    tags=["Cameras"]
)

@router.post("", response_model=CameraResponse)
async def add_camera(
    camera: CameraCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only Admin (1) and Teacher (2) can add cameras
    if current_user.role_id not in [1, 2]:
        raise HTTPException(status_code=403, detail="Only admins and teachers can add cameras")

    new_camera = CameraDevice(
        org_id=current_user.org_id,  # Always use the authenticated user's org
        camera_type=camera.camera_type,
        location=camera.location,
        connection_url=camera.connection_url,
        description=camera.description,
        status="active"
    )
    db.add(new_camera)
    await db.commit()
    await db.refresh(new_camera)
    return new_camera

@router.get("", response_model=List[CameraResponse])
async def list_cameras(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Filter by user's org
    result = await db.execute(select(CameraDevice).where(CameraDevice.org_id == current_user.org_id))
    return result.scalars().all()

@router.delete("/{camera_id}")
async def delete_camera(
    camera_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only Admin (1) and Teacher (2) can delete
    if current_user.role_id not in [1, 2]:
        raise HTTPException(status_code=403, detail="Not authorized to delete cameras")

    result = await db.execute(select(CameraDevice).where(CameraDevice.camera_id == camera_id))
    camera = result.scalars().first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    if camera.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    # 1. Check in-memory websocket stream status
    if str(camera_id) in manager.senders:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete camera: it is currently active and streaming a live class."
        )

    # 2. Check scheduled live session status in the database
    now = datetime.now()
    active_session_query = await db.execute(
        select(SessionModel).where(
            SessionModel.camera_id == camera_id,
            SessionModel.start_time <= now,
            SessionModel.end_time >= now
        )
    )
    active_session = active_session_query.scalars().first()
    if active_session:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete camera: it is currently assigned to the live session '{active_session.session_name}'."
        )

    # 3. Safely nullify camera_id in all sessions to satisfy foreign key integrity checks
    await db.execute(
        update(SessionModel)
        .where(SessionModel.camera_id == camera_id)
        .values(camera_id=None)
    )

    # 4. Perform deletion
    await db.delete(camera)
    await db.commit()
    return {"message": "Camera deleted successfully"}

