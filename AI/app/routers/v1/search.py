from fastapi import APIRouter, HTTPException
from app.schemas import SemanticSearchRequest, SemanticSearchResult
from app.services.rag_pipeline import semantic_search
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Semantic Search"])


@router.post("/search/semantic", response_model=list[SemanticSearchResult])
async def semantic_search_endpoint(request: SemanticSearchRequest):
    """
    Semantic similarity search across issues and wiki pages in ChromaDB.
    Returns results ordered by vector similarity to the query.
    """
    logger.info(f"Semantic search: '{request.query[:60]}' k={request.k}")
    try:
        results = semantic_search(request.query, k=request.k)
    except Exception as exc:
        logger.error(f"Semantic search failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    return results
