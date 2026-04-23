from fastapi import APIRouter, HTTPException
from app.schemas import ChatRequest, ChatbotJiraResponse
from app.services.chat_service import simple_chat
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Jira Chatbot"])


@router.post("/chat", response_model=ChatbotJiraResponse)
async def chat(request: ChatRequest):
    """
    Jira Chatbot endpoint.
    - If the user asks a technical question: returns detailed answer in 'logical_thinking'.
    - If the user asks to create a Jira task: returns a concise summary and description.
    """
    logger.info(f"Chat request received: {request.message[:60]}...")
    try:
        response_data = simple_chat(request.message)
    except Exception as exc:
        logger.error(f"Chat failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    return response_data
