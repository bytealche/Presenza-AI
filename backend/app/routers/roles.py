from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.dependencies import get_db
from app.models.role import Role
from app.schemas.role_schema import RoleCreate, RoleResponse

router = APIRouter(
    prefix="/roles",
    tags=["Roles"]
)

@router.post("/", response_model=RoleResponse)
async def create_role(role: RoleCreate, db: AsyncSession = Depends(get_db)):
    new_role = Role(role_name=role.role_name)
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)
    return new_role

@router.get("/", response_model=list[RoleResponse])
async def get_roles(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Role))
    return result.scalars().all()
