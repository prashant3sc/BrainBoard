from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from app.schemas import AnalyzeTicketRequest
from app.services.rag_pipeline import analyze_ticket_with_rag
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Ticket Analysis"])


@router.post("/analyze-ticket")
async def analyze_ticket(request: AnalyzeTicketRequest) -> JSONResponse:
    """
    Full-ticket AI analysis — title, description, labels, and assignee suggestions.

    Accepts pre-computed label frequency and team bandwidth from the Django layer.
    Runs ChromaDB similarity search internally and combines all context into a
    single Claude call. Returns the LLM JSON directly without response_model
    validation so structural variations in the LLM output don't cause 500s.
    """
    logger.info(f"analyze_ticket: '{request.title[:60]}' sprint_id={request.sprint_id}")
    try:
        result = analyze_ticket_with_rag(
            title=request.title,
            description=request.description,
            sprint_id=request.sprint_id,
            frequent_labels=[item.model_dump() for item in request.frequent_labels],
            team_bandwidth=[item.model_dump() for item in request.team_bandwidth],
        )
    except ValueError as exc:
        logger.error(f"analyze_ticket JSON parse failed: {exc}")
        raise HTTPException(status_code=500, detail="AI service error: malformed JSON response")
    except Exception as exc:
        logger.error(f"analyze_ticket failed: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI service error: {exc}")
    return JSONResponse(content=result)
