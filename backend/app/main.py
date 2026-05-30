from contextlib import asynccontextmanager
import logging

from pathlib import Path
import os
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
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
    ai_trigger, analytics, cameras, stream, health, ai_logs
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
    
    # Safety: database schema checks
    from app.database.database import SessionLocal
    from sqlalchemy import text
    try:
        async with SessionLocal() as db:
            # 1. Sessions safety column
            try:
                await db.execute(text("ALTER TABLE sessions ADD COLUMN is_approved BOOLEAN DEFAULT 0"))
                await db.execute(text("UPDATE sessions SET is_approved = 1"))
                await db.commit()
            except Exception:
                pass
            
            # 2. Subject requests table
            bind_url = str(db.bind.url) if db.bind else ""
            if "sqlite" in bind_url:
                await db.execute(text("""
                    CREATE TABLE IF NOT EXISTS subject_requests (
                        request_id INTEGER PRIMARY KEY AUTOINCREMENT,
                        org_id INTEGER,
                        teacher_id INTEGER,
                        subject_name VARCHAR(255) NOT NULL,
                        description TEXT,
                        status VARCHAR(50) DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
            else:
                await db.execute(text("""
                    CREATE TABLE IF NOT EXISTS subject_requests (
                        request_id SERIAL PRIMARY KEY,
                        org_id INTEGER,
                        teacher_id INTEGER,
                        subject_name VARCHAR(255) NOT NULL,
                        description TEXT,
                        status VARCHAR(50) DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """))
            await db.commit()
            logger.info("Database safety check: column 'is_approved' and table 'subject_requests' verified/created.")
            
            # 3. Synchronize PostgreSQL database sequences to prevent duplicate primary key conflicts
            if "sqlite" not in bind_url:
                try:
                    logger.info("Synchronizing PostgreSQL sequences...")
                    seq_query = """
                        SELECT
                            t.relname AS table_name,
                            a.attname AS column_name,
                            s.relname AS sequence_name
                        FROM pg_class s
                        JOIN pg_depend d ON d.objid = s.oid AND d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass
                        JOIN pg_class t ON t.oid = d.refobjid
                        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
                        WHERE s.relkind = 'S' AND t.relnamespace = 'public'::regnamespace;
                    """
                    seq_res = await db.execute(text(seq_query))
                    for row in seq_res.fetchall():
                        table, col, seq = row
                        max_res = await db.execute(text(f"SELECT COALESCE(MAX({col}), 0) FROM public.{table}"))
                        max_val = max_res.scalar()
                        if max_val > 0:
                            await db.execute(text(f"SELECT setval('public.{seq}', {max_val}, true)"))
                        else:
                            await db.execute(text(f"SELECT setval('public.{seq}', 1, false)"))
                    await db.commit()
                    logger.info("PostgreSQL sequences synchronized successfully.")
                except Exception as seq_err:
                    logger.warning(f"Failed to synchronize database sequences: {seq_err}")
    except Exception as e:
        logger.error(f"Database safety check failed: {e}")
        
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
app.include_router(ai_logs.router)

# ── Mobile Camera Sender Page ─────────────────────────────────────────────────
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
static_dir = os.path.join(base_dir, "static")
app.mount("/mobile", StaticFiles(directory=static_dir, html=True), name="mobile")

