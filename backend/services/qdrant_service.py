import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    SparseVectorParams,
    SparseIndexParams,
    SparseVector,
    PointStruct,
    PayloadSchemaType,
)

_client = None
VECTOR_SIZE = 384  # BAAI/bge-small-en-v1.5


def get_client() -> QdrantClient:
    global _client
    if _client is None:
        _client = QdrantClient(
            url=os.environ.get("QDRANT_URL", "http://localhost:6333"),
            api_key=os.environ.get("QDRANT_API_KEY"),
        )
    return _client


def ensure_collection(collection_name: str) -> None:
    client = get_client()
    existing = {c.name for c in client.get_collections().collections}
    if collection_name in existing:
        return

    client.create_collection(
        collection_name=collection_name,
        vectors_config={"dense": VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE)},
        sparse_vectors_config={
            "sparse": SparseVectorParams(index=SparseIndexParams(on_disk=False))
        },
    )
    client.create_payload_index(
        collection_name=collection_name,
        field_name="document_id",
        field_schema=PayloadSchemaType.INTEGER,
    )


def upsert_chunks(
    collection_name: str,
    document_id: int,
    filename: str,
    r2_key: str,
    chunks: list[str],
    embeddings: list[list[float]],
    sparse_embeddings: list[dict],
    page_numbers: list[list[int]],
) -> int:
    client = get_client()
    ensure_collection(collection_name)
    points = [
        PointStruct(
            id=str(uuid.uuid4()),
            vector={
                "dense": embedding,
                "sparse": SparseVector(
                    indices=sparse["indices"],
                    values=sparse["values"],
                ),
            },
            payload={
                "document_id": document_id,
                "filename": filename,
                "r2_key": r2_key,
                "chunk_index": i,
                "text": chunk,
                "page_numbers": pages,
            },
        )
        for i, (chunk, embedding, sparse, pages) in enumerate(
            zip(chunks, embeddings, sparse_embeddings, page_numbers)
        )
    ]
    client.upsert(collection_name=collection_name, points=points)
    return len(points)


def delete_document_chunks(collection_name: str, document_id: int) -> None:
    client = get_client()
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    client.delete(
        collection_name=collection_name,
        points_selector=Filter(
            must=[FieldCondition(key="document_id", match=MatchValue(value=document_id))]
        ),
    )
