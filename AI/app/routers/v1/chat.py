import os
from fastapi import APIRouter, HTTPException, Depends
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
    if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
        raise HTTPException(status_code=500, detail="OpenAI API Key not configured in .env file.")

    logger.info(f"Chat request received: {request.message[:60]}...")
    response_data = simple_chat(request.message)
    return response_data
