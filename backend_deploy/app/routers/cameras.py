from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
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

@router.post("/", response_model=CameraResponse)
def add_camera(
    camera: CameraCreate, 
    db: Session = Depends(get_db),
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
    db.commit()
    db.refresh(new_camera)
    return new_camera

@router.get("/", response_model=List[CameraResponse])
def list_cameras(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Filter by user's org
    cameras = db.query(CameraDevice).filter(CameraDevice.org_id == current_user.org_id).all()
    return cameras

@router.delete("/{camera_id}")
def delete_camera(
    camera_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    camera = db.query(CameraDevice).filter(CameraDevice.camera_id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
        
    if camera.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db.delete(camera)
    db.commit()
    return {"message": "Camera deleted"}
