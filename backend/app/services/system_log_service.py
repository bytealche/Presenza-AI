import logging
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.system_log import SystemLog

logger = logging.getLogger(__name__)

async def create_system_log(
    db: AsyncSession,
    action: str,
    user_id: int | None = None,
    ip_address: str | None = None,
    commit: bool = False
) -> SystemLog | None:
    try:
        log = SystemLog(
            user_id=user_id,
            action=action,
            ip_address=ip_address
        )
        db.add(log)
        if commit:
            await db.commit()
        return log
    except Exception as e:
        logger.error(f"Failed to create system log for action '{action}': {e}")
        if commit:
            await db.rollback()
        return None
