import json
import os
import anthropic
from sentence_transformers import CrossEncoder
from qdrant_client.models import SparseVector, Prefetch, Fusion, FusionQuery
from services.document_service import get_embed_model, get_sparse_model
from services.qdrant_service import get_client

RERANK_MODEL_NAME = os.environ.get("RERANK_MODEL", "BAAI/bge-reranker-base")

_rerank_model = None

def get_reranker() -> CrossEncoder:
    global _rerank_model
    if _rerank_model is None:
        _rerank_model = CrossEncoder(RERANK_MODEL_NAME)
    return _rerank_model


def _payload_to_chunk(point) -> dict:
    p = point.payload
    return {
        "id": str(point.id),
        "score": getattr(point, "score", 0.0),
        "text": p.get("text", ""),
        "parent_chunk_id": p.get("parent_chunk_id"),
        "filename": p.get("filename", ""),
        "r2_key": p.get("r2_key"),
        "chunk_index": p.get("chunk_index", 0),
        "page_numbers": p.get("page_numbers", []),
        "document_id": p.get("document_id"),
    }


def hybrid_search(org_slug: str, query: str, k: int = 10) -> list[dict]:
    model = get_embed_model()
    dense_vec = model.encode(query, normalize_embeddings=True).tolist()

    sparse_emb = next(iter(get_sparse_model().query_embed(query)))
    sparse_vec = SparseVector(
        indices=sparse_emb.indices.tolist(),
        values=sparse_emb.values.tolist(),
    )

    client = get_client()
    response = client.query_points(
        collection_name=org_slug,
        prefetch=[
            Prefetch(query=dense_vec, using="dense", limit=k * 2),
            Prefetch(query=sparse_vec, using="sparse", limit=k * 2),
        ],
        query=FusionQuery(fusion=Fusion.RRF),
        limit=k,
        with_payload=True,
    )
    return [_payload_to_chunk(r) for r in response.points]


RERANK_THRESHOLD = float(os.environ.get("RERANK_THRESHOLD", "0.0"))


def _llm_filter(query: str, chunks: list[dict]) -> list[dict]:
    formatted = "\n\n".join(f"[{i}] {c['text']}" for i, c in enumerate(chunks))
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=128,
        system=(
            "You are a relevance filter. Given a query and a list of text chunks, "
            "return a JSON array of the indices of chunks that are relevant to the query. "
            "Example output: [0, 2]. Return an empty array if none are relevant. No explanation."
        ),
        messages=[{"role": "user", "content": f"Query: {query}\n\nChunks:\n{formatted}"}],
    )
    try:
        indices = json.loads(response.content[0].text.strip())
        return [chunks[i] for i in indices if isinstance(i, int) and i < len(chunks)]
    except (json.JSONDecodeError, IndexError):
        return []


def rerank(query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
    if not chunks:
        return []
    reranker = get_reranker()
    pairs = [(query, c["text"]) for c in chunks]
    scores = reranker.predict(pairs)
    ranked = sorted(zip(chunks, scores), key=lambda x: x[1], reverse=True)
    candidates = [chunk for chunk, _ in ranked[:top_k]]
    print("candidates:", candidates)
    return _llm_filter(query, candidates)
