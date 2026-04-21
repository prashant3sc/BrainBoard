import os
from fastapi import APIRouter, HTTPException, Depends
from app.schemas import TeamContextRequest
from app.services.rag_pipeline import add_team_member
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Team Management"])


@router.post("/upload-context")
async def upload_context(context: TeamContextRequest):
    """
    Save a team member's capacity, skills, and workload into the Vector Database.
    This builds the 'knowledge base' for the RAG component.
    """
    if not os.getenv("OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") == "your_openai_api_key_here":
        raise HTTPException(status_code=500, detail="OpenAI API Key not configured in .env file.")

    logger.info(f"Uploading context for team member: {context.member_name}")
    result_message = add_team_member(context)
    return {"success": True, "message": result_message}
