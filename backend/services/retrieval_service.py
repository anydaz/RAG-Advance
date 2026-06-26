import os
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from services.document_service import _get_embed_model
from services.qdrant_service import _get_client

RERANK_MODEL_NAME = os.environ.get("RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")

_rerank_model = None


def _get_reranker() -> CrossEncoder:
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
        "filename": p.get("filename", ""),
        "r2_key": p.get("r2_key"),
        "chunk_index": p.get("chunk_index", 0),
        "page_numbers": p.get("page_numbers", []),
        "document_id": p.get("document_id"),
    }


def semantic_search(org_slug: str, query: str, k: int = 20) -> list[dict]:
    model = _get_embed_model()
    query_vec = model.encode(query, normalize_embeddings=True).tolist()
    client = _get_client()
    response = client.query_points(
        collection_name=org_slug,
        query=query_vec,
        limit=k,
        with_payload=True,
    )
    return [_payload_to_chunk(r) for r in response.points]


def bm25_search(org_slug: str, query: str, k: int = 20) -> list[dict]:
    client = _get_client()
    all_points = []
    offset = None
    while True:
        results, offset = client.scroll(
            collection_name=org_slug,
            with_payload=True,
            limit=1000,
            offset=offset,
        )
        all_points.extend(results)
        if offset is None:
            break

    if not all_points:
        return []

    corpus = [p.payload.get("text", "") for p in all_points]
    tokenized = [doc.lower().split() for doc in corpus]
    bm25 = BM25Okapi(tokenized)
    scores = bm25.get_scores(query.lower().split())

    top_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)[:k]
    out = []
    for i in top_indices:
        if scores[i] > 0:
            chunk = _payload_to_chunk(all_points[i])
            chunk["score"] = float(scores[i])
            out.append(chunk)
    return out


def hybrid_search(org_slug: str, query: str, k: int = 10) -> list[dict]:
    semantic = semantic_search(org_slug, query, k)
    bm25 = bm25_search(org_slug, query, k)

    RRF_K = 60
    rrf_scores: dict[str, float] = {}
    chunks_by_id: dict[str, dict] = {}

    for rank, chunk in enumerate(semantic):
        cid = chunk["id"]
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1 / (RRF_K + rank + 1)
        chunks_by_id[cid] = chunk

    for rank, chunk in enumerate(bm25):
        cid = chunk["id"]
        rrf_scores[cid] = rrf_scores.get(cid, 0.0) + 1 / (RRF_K + rank + 1)
        chunks_by_id[cid] = chunk

    sorted_ids = sorted(rrf_scores, key=lambda x: rrf_scores[x], reverse=True)[:k]
    return [chunks_by_id[cid] for cid in sorted_ids]


RERANK_THRESHOLD = float(os.environ.get("RERANK_THRESHOLD", "0.0"))


def rerank(query: str, chunks: list[dict], top_k: int = 5) -> list[dict]:
    if not chunks:
        return []
    reranker = _get_reranker()
    pairs = [(query, c["text"]) for c in chunks]
    scores = reranker.predict(pairs)
    ranked = sorted(zip(chunks, scores), key=lambda x: x[1], reverse=True)
    return [
        chunk for chunk, score in ranked[:top_k]
        if score >= RERANK_THRESHOLD
    ]
