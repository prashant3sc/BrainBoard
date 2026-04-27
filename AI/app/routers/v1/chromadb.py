from fastapi import APIRouter, HTTPException
from typing import List

from app.schemas import ChromadbQueryRequest, ChromadbQueryResult
from app.services.rag_pipeline import query_chromadb
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["ChromaDB"])


@router.post("/chromadb/query", response_model=List[ChromadbQueryResult])
async def chromadb_query_endpoint(request: ChromadbQueryRequest):
    """
    Targeted vector similarity search against ChromaDB.

    Applies metadata pre-filters for project_id, doc_types, and (optionally)
    sprint_id before running the embedding-based similarity search.

    Called by the Django BE's ChatbotQueryView via a ThreadPoolExecutor worker
    so ChromaDB and bandwidth SQL run in parallel.
    """
    try:
        results = query_chromadb(
            query=request.query,
            project_id=request.project_id,
            doc_types=request.doc_types,
            sprint_id=request.sprint_id,
            top_k=request.top_k,
        )
    except Exception as exc:
        logger.error(f"ChromaDB query failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

    return results
