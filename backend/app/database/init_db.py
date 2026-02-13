from app.database.database import engine
from app.database.base import Base

from app.models.organization import Organization
from app.models.role import Role
from app.models.user import User
from app.models.camera import CameraDevice
from app.models.session import Session
from app.models.face_profile import FaceProfile
from app.models.verification_code import VerificationCode  # Added this
from app.database.database import engine, SessionLocal
from app.database.base import Base
from app.models import *
from app.database.seed_roles import seed_roles
from app.database.seed_organizations import seed_organizations

def init_db():
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    seed_organizations(db)
    seed_roles(db)
    db.close()
