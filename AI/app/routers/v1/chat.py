from fastapi import APIRouter, HTTPException
from app.schemas import ChatRequest, ChatbotResponse
from app.services.chat_service import chat_with_rag
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Chatbot"])


@router.post("/chat", response_model=ChatbotResponse)
async def chat(request: ChatRequest):
    """
    RAG-powered read-only BrainBoard assistant.

    Searches ChromaDB (issues + wiki) for relevant context,
    then answers questions about projects, issues, sprints, team members, and wiki.
    Rejects questions outside BrainBoard's scope.
    """
    logger.info(f"Chat request: '{request.message[:60]}' | project={request.project_name}")
    try:
        result = chat_with_rag(
            message=request.message,
            project_name=request.project_name,
        )
    except Exception as exc:
        logger.error(f"Chat failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    return result
