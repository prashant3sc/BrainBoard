from fastapi import APIRouter, HTTPException
from app.schemas import ChatbotQueryRequest, ChatbotQueryResponse
from app.services.chatbot_service import chatbot_query
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Chatbot Query"])


@router.post("/chatbot/query", response_model=ChatbotQueryResponse)
async def chatbot_query_endpoint(request: ChatbotQueryRequest):
    """
    Project-scoped RAG chatbot.

    Accepts a natural-language query with optional project/sprint scope,
    current page context, and up to 4 prior conversation turns.
    Returns an answer grounded in ChromaDB-indexed workspace data and
    structured source references.
    """
    logger.info(
        f"Chatbot query: '{request.query[:60]}' | project_id={request.project_id} "
        f"sprint_id={request.sprint_id} page={request.page}"
    )

    # project_name / sprint_name are resolved by the Django BE before forwarding;
    # project_id / sprint_id here are the resolved names passed as those fields
    # (see ai_client.chatbot_query which maps names → these fields).
    try:
        result = chatbot_query(
            query=request.query,
            project_name=request.project_id,   # Django passes resolved name in this field
            sprint_name=request.sprint_id,      # Django passes resolved name in this field
            page=request.page,
            history=[h.model_dump() for h in request.history],
            page_context=request.page_context or None,
        )
    except Exception as exc:
        logger.error(f"Chatbot query failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

    return result
