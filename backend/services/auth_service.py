from fastapi import HTTPException
from sqlalchemy.orm import Session

import auth
from database import tenant_session
from repositories import org_repository, user_repository


def check_org(org_slug: str, db: Session):
    org = org_repository.find_by_slug(org_slug.lower(), db)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def login(org_slug: str, username: str, password: str, db: Session) -> str:
    org = check_org(org_slug, db)
    with tenant_session(org.slug) as tdb:
        user = user_repository.find_by_username(username, tdb)
        if not user or not auth.verify_password(password, user.hashed_password):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return auth.create_token(user.id, org.slug, user.username)


def get_current_user(token: str, db: Session):
    payload = auth.decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    org = org_repository.find_by_slug(payload["org"], db)
    if not org:
        raise HTTPException(status_code=401, detail="Organization not found")
    with tenant_session(org.slug) as tdb:
        user = user_repository.find_by_id(int(payload["sub"]), tdb)
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
    return user, org
