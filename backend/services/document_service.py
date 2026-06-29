import io
import os
import uuid

from fastapi import HTTPException
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import DocumentStream, InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.chunking import HybridChunker
from fastembed import SparseTextEmbedding
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session

from database.models import Document, ParentChunk
from services import r2_service, qdrant_service
from config import prefixed

EMBED_MODEL_NAME = os.environ.get("EMBED_MODEL", "BAAI/bge-small-en-v1.5")
SPARSE_MODEL_NAME = os.environ.get("SPARSE_MODEL", "Qdrant/bm25")

_converter: DocumentConverter | None = None
_chunker: HybridChunker | None = None
_embed_model: SentenceTransformer | None = None
_sparse_model: SparseTextEmbedding | None = None


def _get_converter() -> DocumentConverter:
    global _converter
    if _converter is None:
        pipeline_options = PdfPipelineOptions()
        pipeline_options.do_ocr = False
        _converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
            }
        )
    return _converter


def _get_chunker() -> HybridChunker:
    global _chunker
    if _chunker is None:
        _chunker = HybridChunker(tokenizer=EMBED_MODEL_NAME)
    return _chunker


def get_embed_model() -> SentenceTransformer:
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
    return _embed_model


def get_sparse_model() -> SparseTextEmbedding:
    global _sparse_model
    if _sparse_model is None:
        _sparse_model = SparseTextEmbedding(model_name=SPARSE_MODEL_NAME)
    return _sparse_model


def _convert_pdf(pdf_bytes: bytes, filename: str):
    stream = DocumentStream(name=filename, stream=io.BytesIO(pdf_bytes))
    result = _get_converter().convert(stream)
    return result.document


def _page_numbers(chunk) -> list[int]:
    pages: set[int] = set()
    for item in chunk.meta.doc_items:
        for prov in item.prov:
            pages.add(prov.page_no)
    return sorted(pages)


def _semantic_chunks(doc) -> tuple[list[tuple[str, str, list[int]]], dict[tuple, list[int]]]:
    """Returns (chunk_list, groups).

    chunk_list: list of (raw_text, contextualized_text, page_numbers)
    groups: heading_key -> [child indices] — siblings under the same section heading.
    """
    from collections import defaultdict
    chunker = _get_chunker()
    raw_chunks = []
    for chunk in chunker.chunk(dl_doc=doc):
        if not chunk.text.strip():
            continue
        headings = getattr(chunk.meta, "headings", None) or []
        heading_prefix = " > ".join(headings)
        # Prepend heading path so heading keywords are indexed by both dense and sparse.
        raw_text = f"{heading_prefix}\n{chunk.text}" if heading_prefix else chunk.text
        raw_chunks.append((chunk, raw_text, chunker.contextualize(chunk=chunk), _page_numbers(chunk)))

    groups: dict[tuple, list[int]] = defaultdict(list)
    for i, (chunk, _, _, _) in enumerate(raw_chunks):
        headings = tuple(getattr(chunk.meta, "headings", None) or ())
        key = headings if headings else (i,)
        groups[key].append(i)

    return [(raw_text, ctx, pages) for _, raw_text, ctx, pages in raw_chunks], groups


def _embed(texts: list[str]) -> list[list[float]]:
    return get_embed_model().encode(texts, normalize_embeddings=True).tolist()


def _sparse_embed(texts: list[str]) -> list[dict]:
    model = get_sparse_model()
    return [
        {"indices": emb.indices.tolist(), "values": emb.values.tolist()}
        for emb in model.embed(texts)
    ]


def ingest_pdf(org_slug: str, filename: str, pdf_bytes: bytes, db: Session) -> dict:
    r2_key = f"{prefixed(org_slug)}/{uuid.uuid4()}/{filename}"

    doc_row = Document(org_slug=org_slug, filename=filename, r2_key=r2_key, status="processing")
    db.add(doc_row)
    db.commit()
    db.refresh(doc_row)

    try:
        r2_service.upload_pdf(pdf_bytes, r2_key)

        dl_doc = _convert_pdf(pdf_bytes, filename)
        markdown = dl_doc.export_to_markdown()

        if not markdown.strip():
            raise ValueError("PDF contains no extractable text")

        chunk_list, groups = _semantic_chunks(dl_doc)
        raw_texts = [t[0] for t in chunk_list]
        ctx_texts = [t[1] for t in chunk_list]
        page_numbers = [t[2] for t in chunk_list]

        # Insert one ParentChunk per section; flush to get DB-assigned IDs.
        parent_chunk_ids: list[int] = [0] * len(raw_texts)
        for indices in groups.values():
            parent_text = "\n\n".join(raw_texts[i] for i in indices)
            parent = ParentChunk(document_id=doc_row.id, text=parent_text)
            db.add(parent)
            db.flush()
            for i in indices:
                parent_chunk_ids[i] = parent.id

        embeddings = _embed(ctx_texts)
        sparse_embeddings = _sparse_embed(raw_texts)

        chunk_count = qdrant_service.upsert_chunks(
            collection_name=org_slug,
            document_id=doc_row.id,
            filename=filename,
            r2_key=r2_key,
            chunks=raw_texts,
            embeddings=embeddings,
            sparse_embeddings=sparse_embeddings,
            parent_chunk_ids=parent_chunk_ids,
            page_numbers=page_numbers,
        )

        doc_row.status = "ready"
        doc_row.chunk_count = chunk_count
        db.commit()

    except Exception as exc:
        db.query(ParentChunk).filter(ParentChunk.document_id == doc_row.id).delete()
        doc_row.status = "failed"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {exc}") from exc

    return {
        "id": doc_row.id,
        "org_slug": org_slug,
        "filename": doc_row.filename,
        "r2_key": doc_row.r2_key,
        "status": doc_row.status,
        "chunk_count": doc_row.chunk_count,
    }


def delete_document(document_id: int, db: Session) -> None:
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    try:
        r2_service.delete_pdf(doc.r2_key)
    except Exception:
        pass  # don't block deletion if R2 object is already gone

    try:
        qdrant_service.delete_document_chunks(doc.org_slug, doc.id)
    except Exception:
        pass  # don't block deletion if collection/chunks are already gone

    db.delete(doc)
    db.commit()


def list_documents(org_slug: str, db: Session) -> list[dict]:
    docs = (
        db.query(Document)
        .filter(Document.org_slug == org_slug)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "status": d.status,
            "chunk_count": d.chunk_count,
            "created_at": d.created_at.isoformat(),
            "url": r2_service.get_presigned_url(d.r2_key) if d.status == "ready" else None,
        }
        for d in docs
    ]
