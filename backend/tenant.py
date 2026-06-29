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

CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    org_slug VARCHAR NOT NULL,
    filename VARCHAR NOT NULL,
    r2_key VARCHAR NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'processing',
    chunk_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    username VARCHAR NOT NULL,
    title VARCHAR NOT NULL DEFAULT 'New chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_sessions_username_idx ON chat_sessions (username);

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR NOT NULL,
    content TEXT NOT NULL,
    sources TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS chat_messages_session_id_idx ON chat_messages (session_id);

CREATE TABLE IF NOT EXISTS parent_chunks (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    text TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS parent_chunks_document_id_idx ON parent_chunks (document_id);
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
