import asyncio
import json
import os
from typing import AsyncIterator, TypedDict

import anthropic
from langgraph.graph import StateGraph, END

from services.retrieval_service import hybrid_search, rerank

HAIKU_MODEL = "claude-haiku-4-5"


class RAGState(TypedDict):
    org_slug: str
    query: str
    chunks: list[dict]


def _retrieve(state: RAGState) -> dict:
    chunks = hybrid_search(state["org_slug"], state["query"], k=20)
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


def _build_context(chunks: list[dict]) -> str:
    parts = []
    for i, c in enumerate(chunks, 1):
        pages = ", ".join(str(p) for p in c.get("page_numbers", []))
        page_str = f"page {pages}" if pages else "unknown page"
        parts.append(f"[{i}] {c['filename']} — {page_str}\n{c['text']}")
    return "\n\n---\n\n".join(parts)


async def stream_rag_answer(org_slug: str, query: str) -> AsyncIterator[str]:
    loop = asyncio.get_event_loop()
    state = await loop.run_in_executor(
        None,
        lambda: _graph.invoke({"org_slug": org_slug, "query": query, "chunks": []}),
    )

    chunks = state["chunks"]
    context = _build_context(chunks)

    system = (
        "You are a helpful assistant. Answer the user's question using only the provided context. "
        "Be concise and accurate. Cite sources by their number [1], [2], etc. "
        "If the context doesn't contain enough information, say so clearly."
    )
    user_message = f"Context:\n\n{context}\n\nQuestion: {query}"

    sources = [
        {
            "filename": c["filename"],
            "page_numbers": c.get("page_numbers", []),
            "chunk_index": c.get("chunk_index", 0),
        }
        for c in chunks
    ]

    yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    async with client.messages.stream(
        model=HAIKU_MODEL,
        max_tokens=1024,
        system=system,
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        async for text in stream.text_stream:
            yield f"data: {json.dumps({'type': 'token', 'text': text})}\n\n"

    yield "data: [DONE]\n\n"
