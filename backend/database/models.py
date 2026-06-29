from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
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


class Document(Base):
    """Tracks uploaded PDFs — lives in the tenant schema."""
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    org_slug = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    r2_key = Column(String, nullable=False)
    status = Column(String, nullable=False, default="processing")  # processing | ready | failed
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ParentChunk(Base):
    """Section-level text used for parent expansion — lives in the tenant schema."""
    __tablename__ = "parent_chunks"

    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)


class ChatSession(Base):
    """A conversation thread — lives in the tenant schema."""
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True)
    username = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False, default="New chat")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class ChatMessage(Base):
    """A single turn within a chat session — lives in the tenant schema."""
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    sources = Column(Text, nullable=True)  # JSON array of source objects
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
