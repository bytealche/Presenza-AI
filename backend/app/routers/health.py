from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import logging

from app.database.dependencies import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Liveness probe")
async def health_check():
    """Returns 200 OK if the application process is running."""
    return {"status": "ok"}


@router.get("/health/ready", summary="Readiness probe")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """
    Returns 200 if the application is ready to handle requests.
    Checks database connectivity. Returns 503 on failure.
    """
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        logger.error(f"Readiness check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unavailable", "database": "unreachable"},
        )
