from pydantic import BaseModel
from typing import List, Dict, Optional


class JiraTaskRequest(BaseModel):
    heading: str
    description: str
    labels: List[str] = []


class IssueDocument(BaseModel):
    issue_id: str
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


class ChatRequest(BaseModel):
    message: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None


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


# ── Analyze Ticket ────────────────────────────────────────────────────────────

class TeamMemberBandwidth(BaseModel):
    id: str
    name: str
    open_tickets: int
    high_priority_count: int


class FrequentLabel(BaseModel):
    label: str
    usage_count: int


class AnalyzeTicketRequest(BaseModel):
    title: str
    description: str
    sprint_id: Optional[str] = None
    frequent_labels: List[FrequentLabel] = []
    team_bandwidth: List[TeamMemberBandwidth] = []


class AssigneeInfo(BaseModel):
    id: Optional[str] = None
    name: str
    reason: str


class LabelChanges(BaseModel):
    add: List[str] = []
    remove: List[str] = []


class AnalyzeTicketResponse(BaseModel):
    title_suggestion: str
    description_expansion: str
    label_changes: LabelChanges
    suggested_assignee: AssigneeInfo
    not_recommended: Optional[AssigneeInfo] = None
