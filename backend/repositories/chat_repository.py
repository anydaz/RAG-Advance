import json
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

def create_session(db: Session, username: str, title: str) -> dict:
    row = db.execute(
        text("""
            INSERT INTO chat_sessions (username, title, created_at, updated_at)
            VALUES (:username, :title, NOW(), NOW())
            RETURNING id, username, title, created_at, updated_at
        """),
        {"username": username, "title": title},
    ).fetchone()
    db.flush()
    return _session_row(row)


def list_sessions(db: Session, username: str) -> list[dict]:
    rows = db.execute(
        text("""
            SELECT id, username, title, created_at, updated_at
            FROM chat_sessions
            WHERE username = :username
            ORDER BY updated_at DESC
        """),
        {"username": username},
    ).fetchall()
    return [_session_row(r) for r in rows]


def get_session(db: Session, session_id: int) -> dict | None:
    row = db.execute(
        text("""
            SELECT id, username, title, created_at, updated_at
            FROM chat_sessions WHERE id = :id
        """),
        {"id": session_id},
    ).fetchone()
    return _session_row(row) if row else None


def delete_session(db: Session, session_id: int) -> None:
    db.execute(text("DELETE FROM chat_sessions WHERE id = :id"), {"id": session_id})
    db.flush()


def touch_session(db: Session, session_id: int) -> None:
    db.execute(
        text("UPDATE chat_sessions SET updated_at = NOW() WHERE id = :id"),
        {"id": session_id},
    )
    db.flush()


# ---------------------------------------------------------------------------
# Messages
# ---------------------------------------------------------------------------

def save_message(db: Session, session_id: int, role: str, content: str, sources: list | None = None) -> dict:
    row = db.execute(
        text("""
            INSERT INTO chat_messages (session_id, role, content, sources, created_at)
            VALUES (:session_id, :role, :content, :sources, NOW())
            RETURNING id, session_id, role, content, sources, created_at
        """),
        {
            "session_id": session_id,
            "role": role,
            "content": content,
            "sources": json.dumps(sources) if sources is not None else None,
        },
    ).fetchone()
    db.flush()
    return _message_row(row)


def list_messages(db: Session, session_id: int) -> list[dict]:
    rows = db.execute(
        text("""
            SELECT id, session_id, role, content, sources, created_at
            FROM chat_messages
            WHERE session_id = :session_id
            ORDER BY created_at ASC
        """),
        {"session_id": session_id},
    ).fetchall()
    return [_message_row(r) for r in rows]


# ---------------------------------------------------------------------------
# Serialisers
# ---------------------------------------------------------------------------

def _session_row(row) -> dict:
    return {
        "id": row.id,
        "username": row.username,
        "title": row.title,
        "created_at": row.created_at.isoformat(),
        "updated_at": row.updated_at.isoformat(),
    }


def _message_row(row) -> dict:
    return {
        "id": row.id,
        "session_id": row.session_id,
        "role": row.role,
        "content": row.content,
        "sources": json.loads(row.sources) if row.sources else None,
        "created_at": row.created_at.isoformat(),
    }
