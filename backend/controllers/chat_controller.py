from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents.rag_agent import stream_rag_answer

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    org_slug: str
    message: str


@router.post("")
async def chat(body: ChatRequest):
    return StreamingResponse(
        stream_rag_answer(body.org_slug, body.message),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
