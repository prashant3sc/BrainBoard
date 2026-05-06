from fastapi import APIRouter, HTTPException
from app.schemas import (
    JiraTaskRequest, JiraTaskResponse,
    AnalyzeIssueV2Request, AnalyzeIssueV2Response,
)
from app.services.rag_pipeline import analyze_task_with_rag, analyze_issue_v2
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


@router.post("/analyze-issue-v2", response_model=AnalyzeIssueV2Response)
async def analyze_issue_v2_endpoint(request: AnalyzeIssueV2Request):
    """
    Context-aware issue analysis (v2).

    Accepts pre-built context from Django (project labels, team workload,
    sprint summary, similar issues) and returns structured per-field suggestions
    with confidence levels for: story points, issue type, labels, assignee,
    and duplicate detection.
    """
    logger.info(
        f"analyze-issue-v2: {request.heading!r} | "
        f"labels={len(request.project_labels)} | team={len(request.team_members)} | "
        f"similar={len(request.similar_issues)}"
    )
    try:
        result = analyze_issue_v2(
            heading=request.heading,
            description=request.description,
            project_labels=request.project_labels,
            supported_issue_types=request.supported_issue_types,
            team_members=[m.model_dump() for m in request.team_members],
            sprint_summary=request.sprint_summary.model_dump() if request.sprint_summary else None,
            similar_issues=[i.model_dump() for i in request.similar_issues],
        )
    except Exception as exc:
        logger.error(f"analyze-issue-v2 failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    return result
