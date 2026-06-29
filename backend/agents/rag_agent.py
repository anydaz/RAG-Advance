import asyncio
import json
import os
from typing import AsyncIterator, TypedDict

import anthropic
from langgraph.graph import StateGraph, END

from database import tenant_session
from database.models import ParentChunk
from services.retrieval_service import hybrid_search, rerank
from services.r2_service import get_presigned_url

HAIKU_MODEL = "claude-haiku-4-5"
CHAT_WINDOW = int(os.environ.get("CHAT_WINDOW", "10"))  # max previous turns to send


class RAGState(TypedDict):
    org_slug: str
    query: str
    chunks: list[dict]


def _retrieve(state: RAGState) -> dict:
    chunks = hybrid_search(state["org_slug"], state["query"], k=10)
    return {"chunks": chunks}


def _rerank_node(state: RAGState) -> dict:
    reranked = rerank(state["query"], state["chunks"], top_k=5)
    return {"chunks": reranked}


def _build_graph():
    g = StateGraph(RAGState)
    g.add_node("retrieve", _retrieve)
    g.add_node("rerank", _rerank_node)
    g.set_entry_point("retrieve")
    g.add_edge("retrieve", "rerank")
    g.add_edge("rerank", END)
    return g.compile()


_graph = _build_graph()


async def _needs_rewrite(query: str, history_text: str, client: anthropic.AsyncAnthropic) -> bool:
    result = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=5,
        system=(
            "You decide if a question depends on conversation context to be understood. "
            "Answer only YES or NO. "
            "YES = the question uses pronouns or references (it, that, they, this, above, those) that refer to something in the conversation, or is a vague instruction like 'explain more' or 'go on'. "
            "NO = the question is fully self-contained and makes sense without any prior context."
        ),
        messages=[{
            "role": "user",
            "content": f"Conversation so far:\n{history_text}\n\nQuestion: {query}",
        }],
    )
    return result.content[0].text.strip().upper().startswith("YES")


async def _rewrite_query(query: str, history: list[dict]) -> str:
    recent = history[-4:]
    history_text = "\n".join(
        f"{m['role'].upper()}: {m['content'][:400]}" for m in recent
    )
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    if not await _needs_rewrite(query, history_text, client):
        return query

    result = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=80,
        system=(
            "You are a query rewriter. "
            "Rewrite the follow-up question into a fully self-contained search query using context from the conversation. "
            "Return only the rewritten query — no explanation, no punctuation at the end."
        ),
        messages=[{
            "role": "user",
            "content": (
                f"Conversation so far:\n{history_text}\n\n"
                f"Follow-up question: {query}\n\n"
                "Standalone search query:"
            ),
        }],
    )
    return result.content[0].text.strip()


def _fetch_parent_texts(org_slug: str, chunks: list[dict]) -> dict[int, str]:
    parent_ids = {c["parent_chunk_id"] for c in chunks if c.get("parent_chunk_id")}
    if not parent_ids:
        return {}
    with tenant_session(org_slug) as db:
        rows = db.query(ParentChunk).filter(ParentChunk.id.in_(parent_ids)).all()
        return {row.id: row.text for row in rows}


def _build_context(chunks: list[dict], parent_map: dict[int, str]) -> str:
    parts = []
    for i, c in enumerate(chunks, 1):
        pages = ", ".join(str(p) for p in c.get("page_numbers", []))
        page_str = f"page {pages}" if pages else "unknown page"
        context_text = parent_map.get(c.get("parent_chunk_id")) or c["text"]
        parts.append(f"[{i}] {c['filename']} — {page_str}\n{context_text}")
    return "\n\n---\n\n".join(parts)


async def stream_rag_answer(
    org_slug: str,
    query: str,
    history: list[dict] | None = None,
) -> AsyncIterator[str]:
    retrieval_query = await _rewrite_query(query, history) if history else query
    print("original query", query)
    print("rewrite", retrieval_query)

    loop = asyncio.get_event_loop()
    state = await loop.run_in_executor(
        None,
        lambda: _graph.invoke({"org_slug": org_slug, "query": retrieval_query, "chunks": []}),
    )

    chunks = state["chunks"]
    parent_map = _fetch_parent_texts(org_slug, chunks)
    context = _build_context(chunks, parent_map)

    system = (
        "You are a helpful assistant. Answer the user's question using only the provided context. "
        "Be concise and accurate, straight to the point, no need for unnecessary explanation." 
        "Cite sources by their number [1], [2], etc. "
        "If the context doesn't contain enough information, say so clearly."
    )

    url_cache: dict[str, str] = {}
    sources = []
    for c in chunks:
        r2_key = c.get("r2_key")
        if r2_key and r2_key not in url_cache:
            try:
                url_cache[r2_key] = get_presigned_url(r2_key)
            except Exception:
                url_cache[r2_key] = None
        sources.append({
            "filename": c["filename"],
            "page_numbers": c.get("page_numbers", []),
            "chunk_index": c.get("chunk_index", 0),
            "url": url_cache.get(r2_key),
        })

    yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    # Build messages: previous turns (sliding window) + current question with context
    messages = [
        {"role": m["role"], "content": m["content"]}
        for m in (history or [])[-CHAT_WINDOW:]
    ]
    messages.append({"role": "user", "content": f"Context:\n\n{context}\n\nQuestion: {query}"})

    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    async with client.messages.stream(
        model=HAIKU_MODEL,
        max_tokens=1024,
        system=system,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield f"data: {json.dumps({'type': 'token', 'text': text})}\n\n"

    yield "data: [DONE]\n\n"
