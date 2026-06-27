from typing import Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    org_slug: str
    username: str
    message: str
    session_id: Optional[int] = None


@router.post("")
async def chat(body: ChatRequest):
    session_id = chat_service.get_or_create_session(
        body.org_slug, body.username, body.message, body.session_id
    )
    return StreamingResponse(
        chat_service.stream_chat(body.org_slug, body.message, session_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/sessions")
def list_sessions(org_slug: str = Query(...), username: str = Query(...)):
    return chat_service.list_sessions(org_slug, username)


@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: int, org_slug: str = Query(...)):
    return chat_service.get_messages(org_slug, session_id)


@router.delete("/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, org_slug: str = Query(...)):
    chat_service.delete_session(org_slug, session_id)
