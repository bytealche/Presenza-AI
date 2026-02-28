from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.routers import organizations, roles, users, protected, sessions, enrollments, auth, attendance, attendance_views, ai_trigger, analytics, cameras, stream
from app.routers import organizations, roles, users, protected, sessions, enrollments, auth, attendance, attendance_views, ai_trigger, analytics, cameras, stream
from app.ai_engine.face_embedding import load_model

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.exceptions import BaseAPIException
from app.core.rate_limit import limiter

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Loading AI Models...")
    load_model()
    yield
    # Shutdown
    print("Shutting down...")

app = FastAPI(title="Smart Attendance AI", lifespan=lifespan)

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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(organizations.router)
app.include_router(roles.router)
app.include_router(users.router)


app.include_router(auth.router)
app.include_router(protected.router)


app.include_router(sessions.router)
app.include_router(enrollments.router)

app.include_router(attendance.router)
app.include_router(attendance_views.router)
app.include_router(ai_trigger.router)
app.include_router(analytics.router)
app.include_router(cameras.router)
app.include_router(stream.router)

# AI Models loaded via lifespan event
