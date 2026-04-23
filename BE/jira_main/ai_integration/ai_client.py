import requests
from django.conf import settings

AI_BASE_URL = getattr(settings, "AI_SERVICE_URL", "http://localhost:8001")
_TIMEOUT_SHORT = 10
_TIMEOUT_LONG = 180


def _post(path: str, payload: dict, timeout: int = _TIMEOUT_LONG) -> dict:
    url = f"{AI_BASE_URL}{path}"
    response = requests.post(url, json=payload, timeout=timeout)
    response.raise_for_status()
    return response.json()


def _get(path: str, timeout: int = _TIMEOUT_SHORT) -> dict:
    url = f"{AI_BASE_URL}{path}"
    response = requests.get(url, timeout=timeout)
    response.raise_for_status()
    return response.json()


def full_sync(issues: list[dict], wiki_pages: list[dict]) -> dict:
    """Full Postgres → ChromaDB resync: clears and re-embeds all issues + wiki pages."""
    return _post("/sync", {"issues": issues, "wiki_pages": wiki_pages})


def sync_status() -> dict:
    """Returns ChromaDB document counts by type for drift detection."""
    return _get("/sync/status")


def analyze_task(heading: str, description: str, labels: list[str]) -> dict:
    """Label-aware RAG: story point estimate + assignee recommendation."""
    return _post("/analyze-task", {
        "heading": heading,
        "description": description,
        "labels": labels,
    })


def chat(message: str) -> dict:
    return _post("/chat", {"message": message})


def health_check() -> dict:
    return _get("/health", timeout=_TIMEOUT_SHORT)
