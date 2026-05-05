from pydantic import BaseModel
from typing import List, Dict, Optional


class JiraTaskRequest(BaseModel):
    heading: str
    description: str
    labels: List[str] = []


class IssueDocument(BaseModel):
    issue_id: str
    ticket_id: Optional[str] = None
    title: str
    description: str
    labels: List[str]
    assignee: str
    story_points: Optional[float] = None
    project: str
    issue_type: str
    priority: str
    status: str


class WikiDocument(BaseModel):
    wiki_id: str
    title: str
    content: str
    project: str
    space: Optional[str] = None
    parent_title: Optional[str] = None
    created_by: Optional[str] = None


class UserDocument(BaseModel):
    user_id: str
    name: str
    email: str
    role: str
    projects: List[str] = []


class ProjectDocument(BaseModel):
    project_id: str
    name: str
    description: str
    owner: str
    members: List[str] = []
    is_archived: bool = False


class SprintDocument(BaseModel):
    sprint_id: str
    name: str
    project: str
    status: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    total_issues: int = 0
    done_issues: int = 0


class FullSyncRequest(BaseModel):
    """Full resync payload — clears ChromaDB and rebuilds from all Postgres data."""
    issues: List[IssueDocument] = []
    wiki_pages: List[WikiDocument] = []
    users: List[UserDocument] = []
    projects: List[ProjectDocument] = []
    sprints: List[SprintDocument] = []


class WikiContextPayload(BaseModel):
    title: str
    text: str


class ChatRequest(BaseModel):
    message: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    workspace_context: Optional[str] = None
    wiki_context: Optional[WikiContextPayload] = None


class JiraTaskResponse(BaseModel):
    story_points: float
    justification: str
    required_roles: List[str]
    capacity_analysis: str
    recommended_team: Dict[str, str]


class ChatbotResponse(BaseModel):
    answer: str
    sources: List[str] = []
    out_of_scope: bool = False
    suggestion: Optional[str] = None


# Keep old name as alias so existing imports don't break
ChatbotJiraResponse = ChatbotResponse


class SprintIssueItem(BaseModel):
    title: str
    status: str
    priority: str
    labels: List[str] = []
    assignee: str = ""
    story_points: Optional[float] = None


class SprintInfo(BaseModel):
    name: str
    start_date: str
    end_date: str


class SprintPulseRequest(BaseModel):
    sprint: SprintInfo
    issues: List[SprintIssueItem]


class SprintHighlight(BaseModel):
    text: str
    tag: str


class SprintPulseResponse(BaseModel):
    summary: str
    highlights: List[SprintHighlight]


class SemanticSearchRequest(BaseModel):
    query: str
    k: int = 10


class SemanticSearchResult(BaseModel):
    id: str
    type: str
    title: str
    excerpt: str


class UpsertDocumentRequest(BaseModel):
    """Single-document upsert into ChromaDB from a Celery embedding task."""
    doc_id: str
    text: str
    metadata: Dict[str, str]  # ChromaDB requires str values


class UpsertDocumentResponse(BaseModel):
    doc_id: str
    status: str = "upserted"


class ChatHistoryItem(BaseModel):
    role: str
    content: str


class ChatbotQueryRequest(BaseModel):
    query: str
    project_id: Optional[str] = None
    sprint_id: Optional[str] = None
    page: Optional[str] = None
    history: List[ChatHistoryItem] = []
    # Pre-rendered live data from Postgres (built by Django's get_page_context).
    # Empty string when not applicable (e.g. wiki page).
    page_context: str = ""


class ChatbotQuerySource(BaseModel):
    type: str
    id: str
    title: str


class ChatbotQueryResponse(BaseModel):
    answer: str
    sources: List[ChatbotQuerySource] = []


# ---------------------------------------------------------------------------
# ChromaDB query (POST /chromadb/query)
# ---------------------------------------------------------------------------

class ChromadbQueryRequest(BaseModel):
    """Direct ChromaDB vector search with optional metadata pre-filtering."""
    query: str
    project_id: Optional[str] = None
    doc_types: List[str] = []
    sprint_id: Optional[str] = None
    top_k: int = 6


class ChromadbQueryResult(BaseModel):
    """Single document result returned by /chromadb/query."""
    type: str
    id: str
    title: str
    text: str


# ---------------------------------------------------------------------------
# Plain-text LLM generation (POST /llm/generate)
# ---------------------------------------------------------------------------

class LlmMessageItem(BaseModel):
    """Single message in an OpenAI-style conversation turn."""
    role: str     # "system" | "user" | "assistant"
    content: str


class LlmGenerateRequest(BaseModel):
    """Full messages array for a direct LLM call."""
    messages: List[LlmMessageItem]
    model_key: str = "chat"   # "rag" | "chat"
    json_mode: bool = False   # True → enforce JSON object output


class LlmGenerateResponse(BaseModel):
    """Plain-text response from the LLM."""
    text: str


# ---------------------------------------------------------------------------
# Sprint Retro (POST /sprint-retro)
# ---------------------------------------------------------------------------

class SprintRetroIssueItem(BaseModel):
    title: str
    status: str
    priority: str
    assignee: str = ""
    story_points: Optional[float] = None
    ticket_id: Optional[str] = None
    issue_type: str = "task"


class SprintRetroRequest(BaseModel):
    sprint_id: str
    sprint_name: str
    goal: str = ""
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    issues: List[SprintRetroIssueItem]


class SprintRetroResponse(BaseModel):
    sprint_name: str
    summary: str
    wins: List[str]
    bottlenecks: List[str]
    repeated_blockers: List[str]
    scope_changes: List[str]
    workload_notes: List[str]
    patterns: List[str]
    action_items: List[str]
    confidence: str          # "high" | "medium" | "low"
    confidence_reason: str
