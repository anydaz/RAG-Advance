import asyncio
import json
import os
from typing import AsyncIterator, TypedDict

import anthropic
from langgraph.graph import StateGraph, END

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


async def _rewrite_query(query: str, history: list[dict]) -> str:
    recent = history[-4:]
    history_text = "\n".join(
        f"{m['role'].upper()}: {m['content'][:400]}" for m in recent
    )
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    result = await client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=80,
        system=(
            "You rewrite follow-up questions into standalone search queries. "
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


def _build_context(chunks: list[dict]) -> str:
    parts = []
    for i, c in enumerate(chunks, 1):
        pages = ", ".join(str(p) for p in c.get("page_numbers", []))
        page_str = f"page {pages}" if pages else "unknown page"
        parts.append(f"[{i}] {c['filename']} — {page_str}\n{c['text']}")
    return "\n\n---\n\n".join(parts)


async def stream_rag_answer(
    org_slug: str,
    query: str,
    history: list[dict] | None = None,
) -> AsyncIterator[str]:
    retrieval_query = await _rewrite_query(query, history) if history else query


    loop = asyncio.get_event_loop()
    state = await loop.run_in_executor(
        None,
        lambda: _graph.invoke({"org_slug": org_slug, "query": retrieval_query, "chunks": []}),
    )

    chunks = state["chunks"]
    context = _build_context(chunks)

    system = (
        "You are a helpful assistant. Answer the user's question using only the provided context. "
        "Be concise and accurate. Cite sources by their number [1], [2], etc. "
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
