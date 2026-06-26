import io
import os
import uuid

from fastapi import HTTPException
from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import DocumentStream, InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.chunking import HybridChunker
from sentence_transformers import SentenceTransformer
from sqlalchemy.orm import Session

from database.models import Document
from repositories import org_repository
from services import r2_service, qdrant_service

EMBED_MODEL_NAME = os.environ.get("EMBED_MODEL", "BAAI/bge-small-en-v1.5")

_converter: DocumentConverter | None = None
_chunker: HybridChunker | None = None
_embed_model: SentenceTransformer | None = None


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


def _get_embed_model() -> SentenceTransformer:
    global _embed_model
    if _embed_model is None:
        _embed_model = SentenceTransformer(EMBED_MODEL_NAME)
    return _embed_model


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


def _semantic_chunks(doc) -> list[tuple[str, str, list[int]]]:
    """Returns list of (raw_text, contextualized_text, page_numbers) per chunk."""
    chunker = _get_chunker()
    return [
        (chunk.text, chunker.contextualize(chunk=chunk), _page_numbers(chunk))
        for chunk in chunker.chunk(dl_doc=doc)
        if chunk.text.strip()
    ]


def _embed(texts: list[str]) -> list[list[float]]:
    return _get_embed_model().encode(texts, normalize_embeddings=True).tolist()


def ingest_pdf(org_slug: str, filename: str, pdf_bytes: bytes, db: Session) -> dict:
    org = org_repository.find_by_slug(org_slug, db)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    r2_key = f"{org_slug}/{uuid.uuid4()}/{filename}"

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

        chunk_triples = _semantic_chunks(dl_doc)
        raw_texts = [text for text, _, _ in chunk_triples]
        ctx_texts = [ctx for _, ctx, _ in chunk_triples]
        page_numbers = [pages for _, _, pages in chunk_triples]

        embeddings = _embed(ctx_texts)

        chunk_count = qdrant_service.upsert_chunks(
            collection_name=org_slug,
            document_id=doc_row.id,
            filename=filename,
            r2_key=r2_key,
            chunks=raw_texts,
            embeddings=embeddings,
            page_numbers=page_numbers,
        )

        doc_row.status = "ready"
        doc_row.chunk_count = chunk_count
        db.commit()

    except Exception as exc:
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
        r2_service._get_client().delete_object(
            Bucket=os.environ["R2_BUCKET_NAME"],
            Key=doc.r2_key,
        )
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
