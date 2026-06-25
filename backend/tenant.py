import re
from sqlalchemy import text
from sqlalchemy.orm import Session

_SLUG_RE = re.compile(r"^[a-z0-9_]+$")

TENANT_DDL = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR NOT NULL UNIQUE,
    hashed_password VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
"""


def validate_slug(slug: str) -> str:
    slug = slug.lower().strip()
    if not _SLUG_RE.match(slug):
        raise ValueError("Org slug may only contain lowercase letters, digits, and underscores")
    if slug == "public":
        raise ValueError("Reserved slug")
    return slug


def provision_schema(org_slug: str, db: Session) -> None:
    """Create the tenant schema and its tables if they don't exist."""
    db.execute(text(f"CREATE SCHEMA IF NOT EXISTS {org_slug}"))
    db.execute(text(f"SET search_path TO {org_slug}"))
    db.execute(text(TENANT_DDL))
    db.commit()
