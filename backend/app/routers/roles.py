from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.role import Role
from app.schemas.role_schema import RoleCreate, RoleResponse

router = APIRouter(
    prefix="/roles",
    tags=["Roles"]
)

@router.post("/", response_model=RoleResponse)
def create_role(role: RoleCreate, db: Session = Depends(get_db)):
    new_role = Role(role_name=role.role_name)
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    return new_role

@router.get("/", response_model=list[RoleResponse])
def get_roles(db: Session = Depends(get_db)):
    return db.query(Role).all()
