from fastapi import APIRouter, HTTPException
from app.schemas import SprintRetroRequest, SprintRetroResponse
from app.services.sprint_retro_service import generate_sprint_retro
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Sprint Retro"])


@router.post("/sprint-retro", response_model=SprintRetroResponse)
async def sprint_retro(request: SprintRetroRequest):
    """
    Generate a structured AI sprint retrospective for a completed sprint.
    Called by Django BE's POST /sprints/<id>/retro/generate endpoint.
    """
    logger.info(
        f"Sprint retro request: '{request.sprint_name}' | "
        f"{len(request.issues)} issues"
    )
    try:
        result = generate_sprint_retro(
            sprint_name=request.sprint_name,
            sprint_goal=request.goal,
            start_date=request.start_date or "",
            end_date=request.end_date or "",
            issues=[i.model_dump() for i in request.issues],
        )
    except Exception as exc:
        logger.error(f"Sprint retro failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    return result
