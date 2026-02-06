from app.database.database import engine
from app.database.base import Base
from app.models.user import User
from app.models.organization import Organization
from app.models.role import Role
from app.models.camera import CameraDevice
# Import other models to ensure they are registered in Base.metadata
from app.models.session import Session
from app.models.attendance import AttendanceRecord
from app.models.enrollment import Enrollment

print("Resetting database schema...")
try:
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Schema reset successful.")
except Exception as e:
    print(f"Error resetting schema: {e}")
