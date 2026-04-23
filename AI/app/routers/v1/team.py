from fastapi import APIRouter, HTTPException
from app.schemas import FullSyncRequest
from app.services.rag_pipeline import full_sync, get_sync_status
from app.core.logging import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["Sync"])


@router.post("/sync")
async def sync_all(payload: FullSyncRequest):
    """
    Full resync from Postgres → ChromaDB.

    Sent by Django BE's POST /ai/sync endpoint.
    Clears ALL existing ChromaDB data, then re-embeds:
      - All issues (with labels, assignee, story points)
      - All wiki pages (title + content)

    Use this whenever ChromaDB may have drifted from Postgres.
    """
    logger.info(
        f"Full sync: {len(payload.issues)} issues, {len(payload.wiki_pages)} wiki, "
        f"{len(payload.users)} users, {len(payload.projects)} projects, {len(payload.sprints)} sprints"
    )
    try:
        result = full_sync(
            issues=payload.issues,
            wiki_pages=payload.wiki_pages,
            users=payload.users,
            projects=payload.projects,
            sprints=payload.sprints,
        )
        return {"success": True, **result}
    except Exception as exc:
        logger.error(f"Full sync failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/sync/status")
async def sync_status():
    """
    Returns ChromaDB document counts by type.
    Compare against Postgres counts to check if sync is needed.
    """
    try:
        return {"success": True, "chroma": get_sync_status()}
    except Exception as exc:
        logger.error(f"Sync status check failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
