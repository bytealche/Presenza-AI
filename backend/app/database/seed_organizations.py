from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.organization import Organization

async def seed_organizations(db: AsyncSession):
    org_name = "Presenza University"
    result = await db.execute(select(Organization).where(Organization.org_name == org_name))
    exists = result.scalars().first()
    if not exists:
        db.add(Organization(org_name=org_name, org_type="Education"))
        await db.commit()
