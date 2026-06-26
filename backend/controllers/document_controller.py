from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from services import document_service

router = APIRouter(prefix="/admin/documents", tags=["documents"])

MAX_PDF_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("", status_code=201)
async def upload_document(
    org_slug: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        raise HTTPException(status_code=413, detail="File exceeds 50 MB limit")

    return document_service.ingest_pdf(org_slug, file.filename, pdf_bytes, db)


@router.get("/{org_slug}")
def get_documents(org_slug: str, db: Session = Depends(get_db)):
    return document_service.list_documents(org_slug, db)


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    document_service.delete_document(document_id, db)
