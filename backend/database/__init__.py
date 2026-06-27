import os
from contextlib import contextmanager
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://andy:1234@localhost:5432/rag_multitenant")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def tenant_session(org_slug: str):
    """Yields a session with search_path pinned to the tenant schema.
    Commits on clean exit, rolls back on exception."""
    db = SessionLocal()
    try:
        db.execute(text(f"SET search_path TO {org_slug}, public"))
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def get_tenant_db(org_slug: str):
    """FastAPI dependency — yields a tenant-scoped session."""
    with tenant_session(org_slug) as db:
        yield db
