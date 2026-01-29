from fastapi import FastAPI
from app.routers import organizations, roles, users, protected, sessions, enrollments, auth, attendance, attendance_views, ai_trigger
from app.ai_engine.vector_store import load_all_embeddings

app = FastAPI(title="Smart Attendance AI")

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

load_all_embeddings()  # Load embeddings on startup