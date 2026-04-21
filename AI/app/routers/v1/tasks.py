import os
from fastapi import APIRouter, HTTPException, Depends
from app.schemas import JiraTaskRequest, JiraTaskResponse
from app.services.rag_pipeline import analyze_task_with_rag
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Jira Task Analysis"])


@router.post("/analyze-task", response_model=JiraTaskResponse)
async def analyze_task(request: JiraTaskRequest):
    """
    Takes a Jira Task heading and description.
    Uses RAG to retrieve team context, then calls the LLM to estimate story points
    and recommend the best-fit team member based on capacity and skills.
    """
    if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
        raise HTTPException(status_code=500, detail="OpenAI API Key not configured in .env file.")

    logger.info(f"Analyzing task: {request.heading}")
    result_data = analyze_task_with_rag(request.heading, request.description)
    return result_data
