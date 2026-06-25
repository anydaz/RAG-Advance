from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])


class CreateOrgRequest(BaseModel):
    slug: str
    display_name: str


class CreateUserRequest(BaseModel):
    org_slug: str
    username: str
    password: str


@router.post("/orgs", status_code=201)
def create_org(body: CreateOrgRequest, db: Session = Depends(get_db)):
    return admin_service.create_org(body.slug, body.display_name, db)


@router.post("/users", status_code=201)
def create_user(body: CreateUserRequest, db: Session = Depends(get_db)):
    return admin_service.create_user(body.org_slug, body.username, body.password, db)
