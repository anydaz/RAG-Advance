from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


class OrgCheckRequest(BaseModel):
    org_slug: str


class LoginRequest(BaseModel):
    org_slug: str
    username: str
    password: str


def _extract_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    return authorization.removeprefix("Bearer ")


@router.post("/check-org")
def check_org(body: OrgCheckRequest, db: Session = Depends(get_db)):
    org = auth_service.check_org(body.org_slug, db)
    return {"org_slug": org.slug, "display_name": org.display_name}


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    token = auth_service.login(body.org_slug, body.username, body.password, db)
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
def me(token: str = Depends(_extract_token), db: Session = Depends(get_db)):
    user, org = auth_service.get_current_user(token, db)
    return {
        "id": user.id,
        "username": user.username,
        "org": org.slug,
        "org_display_name": org.display_name,
    }
