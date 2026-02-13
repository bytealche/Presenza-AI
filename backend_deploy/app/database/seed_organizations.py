from sqlalchemy.orm import Session
from app.models.organization import Organization

def seed_organizations(db: Session):
    org_name = "Presenza University"
    exists = db.query(Organization).filter(Organization.org_name == org_name).first()
    if not exists:
        db.add(Organization(org_name=org_name, org_type="Education"))
        db.commit()
