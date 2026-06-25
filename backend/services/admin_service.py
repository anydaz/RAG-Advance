from fastapi import HTTPException
from sqlalchemy.orm import Session

import auth
import tenant as tenant_utils
from database import tenant_session
from repositories import org_repository, user_repository


def create_org(slug: str, display_name: str, db: Session):
    slug = tenant_utils.validate_slug(slug)
    if org_repository.find_by_slug(slug, db):
        raise HTTPException(status_code=409, detail="Organization already exists")
    org = org_repository.create(slug, display_name, db)
    tenant_utils.provision_schema(slug, db)
    db.refresh(org)
    return {"id": org.id, "slug": org.slug, "display_name": org.display_name}


def create_user(org_slug: str, username: str, password: str, db: Session):
    org = org_repository.find_by_slug(org_slug.lower(), db)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    with tenant_session(org.slug) as tdb:
        if user_repository.find_by_username(username, tdb):
            raise HTTPException(status_code=409, detail="Username already taken")
        user = user_repository.create(username, auth.hash_password(password), tdb)
        return {"id": user.id, "username": user.username, "org": org.slug}
