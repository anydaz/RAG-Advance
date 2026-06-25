from sqlalchemy import Column, Integer, String, DateTime
from datetime import datetime, timezone
from database import Base  # noqa: E402 — Base lives in database/__init__.py


class Organization(Base):
    """Shared registry — lives in the public schema."""
    __tablename__ = "organizations"
    __table_args__ = {"schema": "public"}

    id = Column(Integer, primary_key=True)
    slug = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class User(Base):
    """Per-tenant table — resolved via search_path to {org_slug}.users."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, unique=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
