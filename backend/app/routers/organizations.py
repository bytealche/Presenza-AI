from fastapi import APIRouter, Depends
from typing import List
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.organization import Organization
from app.schemas.organization_schema import OrganizationCreate, OrganizationResponse

router = APIRouter(
    prefix="/organizations",
    tags=["Organizations"]
)

@router.post("/", response_model=OrganizationResponse)
def create_organization(
    org: OrganizationCreate,
    db: Session = Depends(get_db)
):
    new_org = Organization(
        org_name=org.org_name,
        org_type=org.org_type
    )
    db.add(new_org)
    db.commit()
    db.refresh(new_org)
    return new_org

@router.get("/", response_model=list[OrganizationResponse])
def list_organizations(db: Session = Depends(get_db)):
    return db.query(Organization).all()