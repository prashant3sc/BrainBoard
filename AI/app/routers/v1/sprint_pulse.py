from fastapi import APIRouter, HTTPException
from app.schemas import SprintPulseRequest, SprintPulseResponse
from app.services.sprint_pulse_service import generate_sprint_pulse
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Sprint Pulse"])


@router.post("/sprint-pulse", response_model=SprintPulseResponse)
async def sprint_pulse(request: SprintPulseRequest):
    """
    Generate AI sprint summary + highlights for the AI Pulse panel.
    Called by Django BE's GET /projects/<id>/ai-pulse endpoint.
    """
    s = request.sprint
    done       = sum(1 for i in request.issues if i.status == "done")
    in_progress = sum(1 for i in request.issues if i.status == "in_progress")
    review     = sum(1 for i in request.issues if i.status == "review")
    todo       = sum(1 for i in request.issues if i.status == "todo")
    points_burned = sum(i.story_points or 0 for i in request.issues if i.status == "done")
    points_total  = sum(i.story_points or 0 for i in request.issues)

    logger.info(
        f"Sprint pulse request: '{s.name}' | "
        f"{len(request.issues)} issues | done={done} ip={in_progress} rv={review} todo={todo}"
    )
    try:
        result = generate_sprint_pulse(
            sprint_name=s.name,
            start_date=s.start_date,
            end_date=s.end_date,
            done=done,
            in_progress=in_progress,
            review=review,
            todo=todo,
            points_burned=points_burned,
            points_total=points_total,
            issues=[i.model_dump() for i in request.issues],
        )
    except Exception as exc:
        logger.error(f"Sprint pulse failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
    return result
