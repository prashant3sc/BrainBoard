from fastapi import APIRouter, HTTPException
from app.schemas import JiraTaskRequest, JiraTaskResponse
from app.services.rag_pipeline import analyze_task_with_rag
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Task Analysis"])


@router.post("/analyze-task", response_model=JiraTaskResponse)
async def analyze_task(request: JiraTaskRequest):
    """
    Analyze a Jira issue using label-aware RAG:
    - Retrieves past issues with matching labels from ChromaDB
    - Estimates story points based on label + description
    - Recommends an assignee based on who handled similar labeled issues
    """
    logger.info(f"Analyzing task: {request.heading} | labels={request.labels}")
    try:
        result_data = analyze_task_with_rag(request.heading, request.description, request.labels)
    except Exception as exc:
        logger.error(f"Task analysis failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    return result_data
