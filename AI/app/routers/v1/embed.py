from fastapi import APIRouter, HTTPException
from app.schemas import UpsertDocumentRequest, UpsertDocumentResponse
from app.services.rag_pipeline import upsert_document
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Embedding"])


@router.post("/embed/upsert", response_model=UpsertDocumentResponse)
async def embed_upsert(request: UpsertDocumentRequest):
    """
    Idempotent single-document upsert.

    Called by Django Celery tasks whenever a ticket, wiki page, sprint, or
    analytics snapshot is created/updated.  Deletes any stale embedding for
    the same `doc_id`, then re-embeds and stores with the new text/metadata.
    """
    logger.info(f"Upsert request: doc_id={request.doc_id} type={request.metadata.get('type')}")
    try:
        upsert_document(request.doc_id, request.text, request.metadata)
    except Exception as exc:
        logger.error(f"Upsert failed for {request.doc_id}: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    return UpsertDocumentResponse(doc_id=request.doc_id)
