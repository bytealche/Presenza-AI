from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List

from app.database.dependencies import get_db
from app.models.camera import CameraDevice
from app.schemas.camera_schema import CameraCreate, CameraResponse
from app.core.auth_dependencies import get_current_user
from app.models.user import User

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
    # Optional: Verify org_id matches user's org
    if current_user.org_id != camera.org_id and current_user.role_id != 1: # Only admin
         raise HTTPException(status_code=403, detail="Not authorized to add camera for this organization")

    new_camera = CameraDevice(
        org_id=camera.org_id,
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
        
    await db.delete(camera)
    await db.commit()
    return {"message": "Camera deleted"}
