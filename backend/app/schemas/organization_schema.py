from pydantic import BaseModel

class OrganizationCreate(BaseModel):
    org_name: str
    org_type: str

class OrganizationResponse(BaseModel):
    org_id: int
    org_name: str
    org_type: str
    status: str

    class Config:
        orm_mode = True
