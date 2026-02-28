from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database.dependencies import get_db
from app.models.organization import Organization
from app.schemas.organization_schema import OrganizationCreate, OrganizationResponse

router = APIRouter(
    prefix="/organizations",
    tags=["Organizations"]
)

@router.post("/", response_model=OrganizationResponse)
async def create_organization(
    org: OrganizationCreate,
    db: AsyncSession = Depends(get_db)
):
    new_org = Organization(
        org_name=org.org_name,
        org_type=org.org_type
    )
    db.add(new_org)
    await db.commit()
    await db.refresh(new_org)
    return new_org

@router.get("/", response_model=list[OrganizationResponse])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Organization))
    return result.scalars().all()