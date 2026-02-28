from fastapi import APIRouter, Depends, UploadFile, File
import cv2
import numpy as np

from app.core.role_dependencies import require_roles
from app.ai_engine.enrollment import enroll_user
from app.database.dependencies import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.face_profile import FaceProfile

router = APIRouter(
    prefix="/ai/enroll",
    tags=["AI Enrollment"]
)

@router.post(
    "/{user_id}",
    dependencies=[Depends(require_roles([1, 2]))]  # admin / teacher
)
async def enroll_face(
    user_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    contents = await file.read()
    np_img = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(np_img, cv2.IMREAD_COLOR)

    path, embedding = enroll_user(user_id, frame)

    record = FaceProfile(
        user_id=user_id,
        embedding=embedding.flatten().tolist()
    )
    db.add(record)
    await db.commit()

    return {"message": "User enrolled successfully"}
