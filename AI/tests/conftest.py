"""
Shared fixtures for the BrainBoard AI test suite.

All external I/O (ChromaDB, OpenAI, Groq) is mocked so the tests run
offline without any API keys or a running database.
"""
import json
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.schemas import (
    IssueDocument, WikiDocument, UserDocument,
    ProjectDocument, SprintDocument,
)


# ---------------------------------------------------------------------------
# Sample document fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def sample_issue() -> IssueDocument:
    return IssueDocument(
        issue_id="issue-001",
        ticket_id="PROJ-42",
        title="Fix login button on mobile",
        description="The login button disappears on screens smaller than 375px.",
        labels=["bug", "frontend"],
        assignee="Alice",
        story_points=2.0,
        project="Alpha",
        issue_type="bug",
        priority="high",
        status="in_progress",
    )


@pytest.fixture
def sample_wiki() -> WikiDocument:
    return WikiDocument(
        wiki_id="wiki-001",
        title="API Design Guidelines",
        content="All endpoints must return JSON. Use snake_case for field names.",
        project="Alpha",
        space="Engineering",
        parent_title="Technical Docs",
        created_by="Bob",
    )


@pytest.fixture
def sample_user() -> UserDocument:
    return UserDocument(
        user_id="user-001",
        name="Alice",
        email="alice@example.com",
        role="Frontend Engineer",
        projects=["Alpha", "Beta"],
    )


@pytest.fixture
def sample_project() -> ProjectDocument:
    return ProjectDocument(
        project_id="proj-001",
        name="Alpha",
        description="Main product project.",
        owner="Charlie",
        members=["Alice", "Bob"],
        is_archived=False,
    )


@pytest.fixture
def sample_sprint() -> SprintDocument:
    return SprintDocument(
        sprint_id="sprint-001",
        name="Sprint 1",
        project="Alpha",
        status="active",
        start_date="2025-05-01",
        end_date="2025-05-14",
        total_issues=10,
        done_issues=4,
    )


# ---------------------------------------------------------------------------
# Mock LLM fixture — returns a configurable JSON string
# ---------------------------------------------------------------------------

def _make_mock_llm(response_json: dict) -> MagicMock:
    mock_msg = MagicMock()
    mock_msg.content = json.dumps(response_json)
    mock_llm = MagicMock()
    mock_llm.__or__ = MagicMock(return_value=mock_llm)  # support `prompt | llm`
    mock_llm.invoke = MagicMock(return_value=mock_msg)
    return mock_llm


@pytest.fixture
def mock_rag_llm_response() -> dict:
    return {
        "reasoning": "Scope MED, Ambiguity MED, anchored to PROJ-10 (3 pts).",
        "story_points": 3.0,
        "justification": "Standard backend feature with minor DB work.",
        "required_roles": ["backend"],
        "capacity_analysis": "Alice handled 5 similar issues.",
        "recommended_team": {"Assigned To": "Alice"},
    }


@pytest.fixture
def mock_analyze_v2_response() -> dict:
    return {
        "story_points": {"value": 2.0, "confidence": "medium", "reason": "Small isolated change."},
        "issue_type": {"value": "bug", "confidence": "high", "reason": "Clearly broken behaviour."},
        "labels": {"values": ["frontend"], "confidence": "high", "reason": "UI-only issue."},
        "assignee": {"name": "Alice", "confidence": "medium", "reason": "Low workload and FE role."},
        "duplicate": {"status": "no", "matching_ticket_ids": [], "confidence": "high", "reason": "Unique issue."},
    }


@pytest.fixture
def mock_chat_response() -> dict:
    return {
        "answer": "There are 3 open bugs in project Alpha.",
        "sources": ["Alpha Sprint Board"],
        "out_of_scope": False,
        "suggestion": None,
    }


# ---------------------------------------------------------------------------
# Mock vector store fixture
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_vector_store():
    vs = MagicMock()
    vs.similarity_search.return_value = []
    vs._collection = MagicMock()
    vs._collection.get.return_value = {"ids": [], "documents": [], "metadatas": []}
    vs._collection.delete = MagicMock()
    vs.add_documents = MagicMock()
    vs.add_texts = MagicMock()
    return vs


# ---------------------------------------------------------------------------
# FastAPI TestClient (no real DB / LLM needed for route-level tests)
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    from app.main import app
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def api_headers():
    """Default headers including the API key used in dev."""
    return {"X-API-Key": "dev-secret-key-change-in-production"}
