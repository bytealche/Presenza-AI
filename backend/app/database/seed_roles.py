from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.role import Role

async def seed_roles(db: AsyncSession):
    roles = ["admin", "teacher", "student"]

    for role_name in roles:
        result = await db.execute(select(Role).where(Role.role_name == role_name))
        exists = result.scalars().first()
        if not exists:
            db.add(Role(role_name=role_name))

    await db.commit()
