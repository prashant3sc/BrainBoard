"""
API endpoint tests using FastAPI TestClient.

All service-layer functions (LLM, ChromaDB) are mocked so these tests
exercise route logic, request validation, response shaping, and error
handling — without any real I/O.
"""
import json
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


# ---------------------------------------------------------------------------
# Health / root
# ---------------------------------------------------------------------------

class TestHealthEndpoints:
    def test_root_returns_service_info(self):
        resp = client.get("/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "running"
        assert "service" in data

    def test_health_check_returns_healthy(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


# ---------------------------------------------------------------------------
# POST /analyze-task
# ---------------------------------------------------------------------------

_RAG_RESPONSE = {
    "reasoning": "Scope MED.",
    "story_points": 3.0,
    "justification": "Mid-complexity bug.",
    "required_roles": ["backend"],
    "capacity_analysis": "Alice handled 5 similar.",
    "recommended_team": {"Assigned To": "Alice"},
}


class TestAnalyzeTaskEndpoint:
    def test_success_returns_200_with_story_points(self):
        with patch(
            "app.routers.v1.tasks.analyze_task_with_rag",
            return_value=_RAG_RESPONSE,
        ):
            resp = client.post(
                "/analyze-task",
                json={
                    "heading": "Fix mobile login",
                    "description": "Button disappears on small screens.",
                    "labels": ["bug", "frontend"],
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["story_points"] == 3.0
        assert data["recommended_team"]["Assigned To"] == "Alice"

    def test_missing_heading_returns_422(self):
        resp = client.post(
            "/analyze-task",
            json={"description": "No heading provided."},
        )
        assert resp.status_code == 422

    def test_missing_description_returns_422(self):
        resp = client.post(
            "/analyze-task",
            json={"heading": "Some heading"},
        )
        assert resp.status_code == 422

    def test_empty_labels_defaults_to_empty_list(self):
        with patch(
            "app.routers.v1.tasks.analyze_task_with_rag",
            return_value=_RAG_RESPONSE,
        ) as mock_fn:
            client.post(
                "/analyze-task",
                json={"heading": "Task", "description": "Description."},
            )
        _, _, labels = mock_fn.call_args[0]
        assert labels == []

    def test_service_exception_returns_500(self):
        with patch(
            "app.routers.v1.tasks.analyze_task_with_rag",
            side_effect=RuntimeError("LLM timeout"),
        ):
            resp = client.post(
                "/analyze-task",
                json={"heading": "T", "description": "D"},
            )
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# POST /analyze-issue-v2
# ---------------------------------------------------------------------------

_ANALYZE_V2_RESPONSE = {
    "story_points": {"value": 2.0, "confidence": "high", "reason": "Small change."},
    "issue_type": {"value": "bug", "confidence": "high", "reason": "Clearly broken."},
    "labels": {"values": ["frontend"], "confidence": "high", "reason": "UI-only issue."},
    "assignee": {"name": "Alice", "confidence": "medium", "reason": "Low workload."},
    "duplicate": {"status": "no", "matching_ticket_ids": [], "confidence": "high", "reason": "Unique."},
}


class TestAnalyzeIssueV2Endpoint:
    def test_success_with_full_payload(self):
        with patch(
            "app.routers.v1.tasks.analyze_issue_v2",
            return_value=_ANALYZE_V2_RESPONSE,
        ):
            resp = client.post(
                "/analyze-issue-v2",
                json={
                    "heading": "Login crash on iOS",
                    "description": "App crashes when tapping login.",
                    "project_labels": ["bug", "frontend"],
                    "supported_issue_types": ["bug", "task"],
                    "team_members": [
                        {"name": "Alice", "role": "FE", "active_issues": 2, "sprint_issues": 1}
                    ],
                    "sprint_summary": {
                        "name": "Sprint 1", "status": "active", "goal": "Ship v2",
                        "todo": 2, "in_progress": 1, "review": 0, "done": 3,
                    },
                    "similar_issues": [],
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["story_points"]["value"] == 2.0
        assert data["assignee"]["name"] == "Alice"
        assert data["duplicate"]["status"] == "no"

    def test_minimal_payload_succeeds(self):
        with patch(
            "app.routers.v1.tasks.analyze_issue_v2",
            return_value=_ANALYZE_V2_RESPONSE,
        ):
            resp = client.post(
                "/analyze-issue-v2",
                json={"heading": "Bug", "description": "Something broken."},
            )
        assert resp.status_code == 200

    def test_missing_heading_returns_422(self):
        resp = client.post(
            "/analyze-issue-v2",
            json={"description": "No heading."},
        )
        assert resp.status_code == 422

    def test_service_exception_returns_500(self):
        with patch(
            "app.routers.v1.tasks.analyze_issue_v2",
            side_effect=ValueError("prompt too long"),
        ):
            resp = client.post(
                "/analyze-issue-v2",
                json={"heading": "H", "description": "D"},
            )
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# POST /chat
# ---------------------------------------------------------------------------

_CHAT_RESPONSE = {
    "answer": "There are 3 open bugs.",
    "sources": ["Alpha Sprint Board"],
    "out_of_scope": False,
    "suggestion": None,
}


class TestChatEndpoint:
    def test_success_returns_answer(self):
        with patch(
            "app.routers.v1.chat.chat_with_rag",
            return_value=_CHAT_RESPONSE,
        ):
            resp = client.post(
                "/chat",
                json={"message": "How many open bugs?"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["answer"] == "There are 3 open bugs."
        assert data["out_of_scope"] is False

    def test_with_project_name(self):
        with patch(
            "app.routers.v1.chat.chat_with_rag",
            return_value=_CHAT_RESPONSE,
        ) as mock_fn:
            client.post(
                "/chat",
                json={"message": "Sprint status?", "project_name": "Alpha"},
            )
        kwargs = mock_fn.call_args[1]
        assert kwargs.get("project_name") == "Alpha"

    def test_with_wiki_context(self):
        with patch(
            "app.routers.v1.chat.chat_with_rag",
            return_value=_CHAT_RESPONSE,
        ) as mock_fn:
            client.post(
                "/chat",
                json={
                    "message": "What format?",
                    "wiki_context": {
                        "title": "API Design",
                        "text": "Use snake_case.",
                    },
                },
            )
        kwargs = mock_fn.call_args[1]
        assert kwargs["wiki_context"] is not None
        assert kwargs["wiki_context"].title == "API Design"

    def test_missing_message_returns_422(self):
        resp = client.post("/chat", json={"project_name": "Alpha"})
        assert resp.status_code == 422

    def test_service_exception_returns_500(self):
        with patch(
            "app.routers.v1.chat.chat_with_rag",
            side_effect=ConnectionError("ChromaDB unreachable"),
        ):
            resp = client.post("/chat", json={"message": "Any question?"})
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# POST /chatbot/query
# ---------------------------------------------------------------------------

_CHATBOT_RESPONSE = {
    "answer": "**Sprint 1** has 4 open issues.",
    "sources": [
        {"type": "sprint", "id": "sprint-1", "title": "Sprint 1"}
    ],
}


class TestChatbotQueryEndpoint:
    def test_success_basic_query(self):
        with patch(
            "app.routers.v1.chatbot.chatbot_query",
            return_value=_CHATBOT_RESPONSE,
        ):
            resp = client.post(
                "/chatbot/query",
                json={"query": "What is the sprint status?"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "Sprint 1" in data["answer"]

    def test_with_history(self):
        with patch(
            "app.routers.v1.chatbot.chatbot_query",
            return_value=_CHATBOT_RESPONSE,
        ) as mock_fn:
            client.post(
                "/chatbot/query",
                json={
                    "query": "Who is assigned to it?",
                    "history": [
                        {"role": "user", "content": "Show sprint issues."},
                        {"role": "assistant", "content": "There are 4 issues."},
                    ],
                },
            )
        kwargs = mock_fn.call_args[1]
        assert len(kwargs["history"]) == 2

    def test_with_project_and_sprint_scope(self):
        with patch(
            "app.routers.v1.chatbot.chatbot_query",
            return_value=_CHATBOT_RESPONSE,
        ) as mock_fn:
            client.post(
                "/chatbot/query",
                json={
                    "query": "What is blocked?",
                    "project_id": "Alpha",
                    "sprint_id": "Sprint 1",
                    "page": "sprint",
                },
            )
        kwargs = mock_fn.call_args[1]
        assert kwargs["project_name"] == "Alpha"
        assert kwargs["sprint_name"] == "Sprint 1"
        assert kwargs["page"] == "sprint"

    def test_missing_query_returns_422(self):
        resp = client.post("/chatbot/query", json={"project_id": "Alpha"})
        assert resp.status_code == 422

    def test_service_exception_returns_500(self):
        with patch(
            "app.routers.v1.chatbot.chatbot_query",
            side_effect=RuntimeError("LLM error"),
        ):
            resp = client.post("/chatbot/query", json={"query": "status?"})
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# POST /embed/upsert
# ---------------------------------------------------------------------------

class TestEmbedUpsertEndpoint:
    def test_success_returns_upserted_status(self):
        with patch("app.routers.v1.embed.upsert_document") as mock_upsert:
            resp = client.post(
                "/embed/upsert",
                json={
                    "doc_id": "ticket_abc",
                    "text": "Fix crash on iOS",
                    "metadata": {"type": "ticket", "project_id": "proj-1"},
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["doc_id"] == "ticket_abc"
        assert data["status"] == "upserted"
        mock_upsert.assert_called_once_with(
            "ticket_abc",
            "Fix crash on iOS",
            {"type": "ticket", "project_id": "proj-1"},
        )

    def test_missing_doc_id_returns_422(self):
        resp = client.post(
            "/embed/upsert",
            json={"text": "some text", "metadata": {}},
        )
        assert resp.status_code == 422

    def test_service_exception_returns_500(self):
        with patch(
            "app.routers.v1.embed.upsert_document",
            side_effect=Exception("DB error"),
        ):
            resp = client.post(
                "/embed/upsert",
                json={"doc_id": "id-1", "text": "text", "metadata": {}},
            )
        assert resp.status_code == 500


# ---------------------------------------------------------------------------
# POST /chromadb/query
# ---------------------------------------------------------------------------

_CHROMADB_RESULTS = [
    {"type": "ticket", "id": "PROJ-1", "title": "Login bug", "text": "Title: Login bug\n..."},
]


class TestChromadbQueryEndpoint:
    def test_success_returns_results(self):
        with patch(
            "app.routers.v1.chromadb.query_chromadb",
            return_value=_CHROMADB_RESULTS,
        ):
            resp = client.post(
                "/chromadb/query",
                json={
                    "query": "login crash",
                    "project_id": "proj-1",
                    "doc_types": ["ticket"],
                    "top_k": 5,
                },
            )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["type"] == "ticket"

    def test_empty_doc_types_returns_empty_list(self):
        with patch(
            "app.routers.v1.chromadb.query_chromadb",
            return_value=[],
        ):
            resp = client.post(
                "/chromadb/query",
                json={"query": "anything", "doc_types": []},
            )
        assert resp.status_code == 200
        assert resp.json() == []

    def test_missing_query_returns_422(self):
        resp = client.post(
            "/chromadb/query",
            json={"doc_types": ["ticket"]},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /llm/generate
# ---------------------------------------------------------------------------

class TestLlmGenerateEndpoint:
    def test_success_returns_text(self):
        mock_msg = MagicMock()
        mock_msg.content = "This is the LLM reply."
        with patch("app.routers.v1.llm.get_llm") as mock_get_llm:
            mock_llm = MagicMock()
            mock_llm.invoke.return_value = mock_msg
            mock_get_llm.return_value = mock_llm

            resp = client.post(
                "/llm/generate",
                json={
                    "messages": [
                        {"role": "system", "content": "You are a helper."},
                        {"role": "user", "content": "Summarize the sprint."},
                    ],
                    "model_key": "chat",
                    "json_mode": False,
                },
            )
        assert resp.status_code == 200
        assert resp.json()["text"] == "This is the LLM reply."

    def test_missing_messages_returns_422(self):
        resp = client.post(
            "/llm/generate",
            json={"model_key": "chat"},
        )
        assert resp.status_code == 422
