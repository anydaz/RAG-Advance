import json
from typing import AsyncIterator

from agents.rag_agent import stream_rag_answer
from database import tenant_session
from repositories import chat_repository


def get_or_create_session(org_slug: str, username: str, message: str, session_id: int | None) -> int:
    with tenant_session(org_slug) as db:
        if session_id:
            session = chat_repository.get_session(db, session_id)
            session_id = session["id"] if session else None

        if not session_id:
            title = message[:60].strip()
            session = chat_repository.create_session(db, username, title)
            session_id = session["id"]

        chat_repository.save_message(db, session_id, "user", message)

    return session_id


async def stream_chat(org_slug: str, message: str, session_id: int) -> AsyncIterator[str]:
    full_text = ""
    final_sources = []

    yield f"data: {json.dumps({'type': 'session', 'session_id': session_id})}\n\n"

    with tenant_session(org_slug) as db:
        all_messages = chat_repository.list_messages(db, session_id)
    # Exclude the just-saved user message (last row); pass the rest as history
    history = all_messages[:-1]

    async for chunk in stream_rag_answer(org_slug, message, history):
        yield chunk

        if chunk.startswith("data: ") and chunk.strip() != "data: [DONE]":
            try:
                payload = json.loads(chunk[6:])
                if payload.get("type") == "token":
                    full_text += payload.get("text", "")
                elif payload.get("type") == "sources":
                    final_sources = payload.get("sources", [])
            except Exception:
                pass

    with tenant_session(org_slug) as db:
        chat_repository.save_message(db, session_id, "assistant", full_text, final_sources)
        chat_repository.touch_session(db, session_id)


def list_sessions(org_slug: str, username: str) -> list[dict]:
    with tenant_session(org_slug) as db:
        return chat_repository.list_sessions(db, username)


def get_messages(org_slug: str, session_id: int) -> list[dict]:
    with tenant_session(org_slug) as db:
        return chat_repository.list_messages(db, session_id)


def delete_session(org_slug: str, session_id: int) -> None:
    with tenant_session(org_slug) as db:
        chat_repository.delete_session(db, session_id)
