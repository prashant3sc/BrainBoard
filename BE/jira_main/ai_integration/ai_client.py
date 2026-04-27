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


def full_sync(
    issues: list[dict],
    wiki_pages: list[dict],
    users: list[dict] | None = None,
    projects: list[dict] | None = None,
    sprints: list[dict] | None = None,
) -> dict:
    """Full Postgres → ChromaDB resync: clears and re-embeds all data."""
    return _post("/sync", {
        "issues":    issues,
        "wiki_pages": wiki_pages,
        "users":     users or [],
        "projects":  projects or [],
        "sprints":   sprints or [],
    })


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


def chat(message: str, project_name: str | None = None) -> dict:
    payload: dict = {"message": message}
    if project_name:
        payload["project_name"] = project_name
    return _post("/chat", payload)


def sprint_pulse(sprint: dict, issues: list[dict]) -> dict:
    """Generate AI sprint summary + highlights for the AI Pulse panel."""
    return _post("/sprint-pulse", {"sprint": sprint, "issues": issues}, timeout=_TIMEOUT_LONG)


def semantic_search(query: str, k: int = 10) -> list[dict]:
    """Semantic similarity search: returns id, type, title, excerpt (no projectId yet)."""
    return _post("/search/semantic", {"query": query, "k": k}, timeout=_TIMEOUT_LONG)


def embed_upsert(doc_id: str, text: str, metadata: dict[str, str]) -> dict:
    """
    Upsert a single document into ChromaDB via the AI service.

    Called from Celery embedding tasks.  `metadata` values must all be strings
    (ChromaDB requirement — cast ints/booleans before calling this).
    """
    return _post("/embed/upsert", {"doc_id": doc_id, "text": text, "metadata": metadata})


def chatbot_query(
    query: str,
    project_name: str | None = None,
    sprint_name: str | None = None,
    page: str | None = None,
    history: list[dict] | None = None,
    page_context: str | None = None,
) -> dict:
    """Project-scoped RAG chatbot with page context and conversation history."""
    return _post("/chatbot/query", {
        "query": query,
        # FastAPI side reads project_name/sprint_name from these fields (see router comment)
        "project_id": project_name,
        "sprint_id": sprint_name,
        "page": page or "",
        "history": history or [],
        "page_context": page_context or "",
    })


def chromadb_query(
    query: str,
    project_id: str | None = None,
    doc_types: list[str] | None = None,
    sprint_id: str | None = None,
    top_k: int = 6,
) -> list[dict]:
    """
    Targeted ChromaDB vector search via the AI service.

    Returns a list of dicts with keys: type, id, title, text.
    Called from a ThreadPoolExecutor worker in ChatbotQueryView.
    """
    return _post("/chromadb/query", {
        "query": query,
        "project_id": project_id,
        "doc_types": doc_types or [],
        "sprint_id": sprint_id,
        "top_k": top_k,
    })


def llm_generate(messages: list[dict], json_mode: bool = False) -> str:
    """
    Call the LLM with a pre-built messages array and return plain text.

    ``messages`` must be a list of {"role": str, "content": str} dicts.
    Returns the model's raw text response (not JSON-parsed).
    """
    result = _post("/llm/generate", {
        "messages": messages,
        "model_key": "chat",
        "json_mode": json_mode,
    })
    return result.get("text", "")


def health_check() -> dict:
    return _get("/health", timeout=_TIMEOUT_SHORT)
