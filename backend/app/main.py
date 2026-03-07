from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.exceptions import BaseAPIException
from app.core.rate_limit import limiter
from app.routers import (
    organizations, roles, users, protected, sessions,
    enrollments, auth, attendance, attendance_views,
    ai_trigger, analytics, cameras, stream, health,
)
from app.ai_engine.face_embedding import load_model

# Initialise logging as early as possible
setup_logging(log_level=settings.LOG_LEVEL, use_json=not settings.DEBUG)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Presenza AI — loading face recognition model...")
    load_model()
    logger.info("AI model loaded successfully.")
    yield
    logger.info("Shutting down Presenza AI.")

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="AI-powered smart attendance and behaviour tracking API.",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.exception_handler(BaseAPIException)
async def custom_exception_handler(request: Request, exc: BaseAPIException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(roles.router)
app.include_router(users.router)
app.include_router(protected.router)
app.include_router(sessions.router)
app.include_router(enrollments.router)
app.include_router(attendance.router)
app.include_router(attendance_views.router)
app.include_router(ai_trigger.router)
app.include_router(analytics.router)
app.include_router(cameras.router)
app.include_router(stream.router)
