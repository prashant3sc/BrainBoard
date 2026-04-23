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


class FullSyncRequest(BaseModel):
    """Full resync payload sent by Django BE — clears ChromaDB and rebuilds from scratch."""
    issues: List[IssueDocument]
    wiki_pages: List[WikiDocument] = []


class ChatRequest(BaseModel):
    message: str


class JiraTaskResponse(BaseModel):
    story_points: float
    justification: str
    required_roles: List[str]
    capacity_analysis: str
    recommended_team: Dict[str, str]


class ChatbotJiraResponse(BaseModel):
    logical_thinking: str
    jira_summary: str
    jira_description: str
