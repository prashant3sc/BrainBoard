from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader
from app.config import get_settings

# Clients must include this header in every request
API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(API_KEY_HEADER)) -> str:
    """
    FastAPI dependency that validates the X-API-Key header.
    Add this as a dependency to any route you want to protect.

    Usage in a router:
        @router.get("/my-route", dependencies=[Depends(verify_api_key)])
    """
    settings = get_settings()

    if not api_key or api_key != settings.app_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API Key. Include 'X-API-Key' header.",
        )
    return api_key
