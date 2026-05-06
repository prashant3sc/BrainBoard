"""
Tests for app/services/rag_pipeline.py

Document-conversion helpers and _extract_* functions are pure and require no
mocks.  Functions that call ChromaDB or an LLM are tested with unittest.mock.
"""
import json
from unittest.mock import MagicMock, patch, call

import pytest

from app.schemas import (
    IssueDocument, WikiDocument, UserDocument,
    ProjectDocument, SprintDocument,
)
from app.services.rag_pipeline import (
    _issue_to_document,
    _wiki_to_document,
    _user_to_document,
    _project_to_document,
    _sprint_to_document,
    _extract_title_simple,
    _extract_excerpt,
    _extract_title_from_doc,
    _get_logical_id,
    get_llm,
    analyze_task_with_rag,
    analyze_issue_v2,
    upsert_document,
    query_chromadb,
    semantic_search,
)


# ===========================================================================
# Document-to-LangChain-Document converters
# ===========================================================================

class TestIssueToDocument:
    def test_page_content_contains_key_fields(self, sample_issue):
        doc = _issue_to_document(sample_issue)
        assert "PROJ-42" in doc.page_content
        assert "Fix login button on mobile" in doc.page_content
        assert "bug, frontend" in doc.page_content
        assert "2.0" in doc.page_content
        assert "Alice" in doc.page_content

    def test_metadata_keys_present(self, sample_issue):
        doc = _issue_to_document(sample_issue)
        assert doc.metadata["doc_type"] == "issue"
        assert doc.metadata["issue_id"] == "issue-001"
        assert doc.metadata["ticket_id"] == "PROJ-42"
        assert doc.metadata["project"] == "Alpha"
        assert doc.metadata["assignee"] == "Alice"

    def test_no_ticket_id_falls_back(self):
        issue = IssueDocument(
            issue_id="issue-002", ticket_id=None,
            title="No ticket", description="desc",
            labels=[], assignee="Bob", project="Beta",
            issue_type="task", priority="low", status="todo",
        )
        doc = _issue_to_document(issue)
        assert doc.metadata["ticket_id"] == ""
        assert "N/A" in doc.page_content

    def test_no_story_points_shows_unestimated(self):
        issue = IssueDocument(
            issue_id="issue-003", ticket_id="X-1",
            title="Unestimated task", description="desc",
            labels=[], assignee="Carol", story_points=None,
            project="Gamma", issue_type="task", priority="medium", status="todo",
        )
        doc = _issue_to_document(issue)
        assert "unestimated" in doc.page_content

    def test_empty_labels_shows_none(self):
        issue = IssueDocument(
            issue_id="i-4", title="t", description="d",
            labels=[], assignee="X", project="P",
            issue_type="task", priority="low", status="todo",
        )
        doc = _issue_to_document(issue)
        assert "Labels: none" in doc.page_content

    def test_description_truncated_at_400_chars(self):
        long_desc = "A" * 600
        issue = IssueDocument(
            issue_id="i-5", title="t", description=long_desc,
            labels=[], assignee="X", project="P",
            issue_type="task", priority="low", status="todo",
        )
        doc = _issue_to_document(issue)
        assert "A" * 401 not in doc.page_content


class TestWikiToDocument:
    def test_with_parent_title(self, sample_wiki):
        doc = _wiki_to_document(sample_wiki)
        assert "Engineering > Technical Docs > API Design Guidelines" in doc.page_content
        assert doc.metadata["doc_type"] == "wiki"
        assert doc.metadata["wiki_id"] == "wiki-001"

    def test_without_parent_title(self):
        wiki = WikiDocument(
            wiki_id="w-2", title="Standalone Page",
            content="Some content.", project="Beta",
            space="General", parent_title=None, created_by=None,
        )
        doc = _wiki_to_document(wiki)
        assert "General > Standalone Page" in doc.page_content
        assert "Unknown" in doc.page_content  # created_by fallback

    def test_content_truncated_at_600_chars(self):
        wiki = WikiDocument(
            wiki_id="w-3", title="Long", content="B" * 800,
            project="P", space="S",
        )
        doc = _wiki_to_document(wiki)
        assert "B" * 601 not in doc.page_content


class TestUserToDocument:
    def test_page_content_and_metadata(self, sample_user):
        doc = _user_to_document(sample_user)
        assert "Alice" in doc.page_content
        assert "alice@example.com" in doc.page_content
        assert "Frontend Engineer" in doc.page_content
        assert "Alpha, Beta" in doc.page_content
        assert doc.metadata["doc_type"] == "user"
        assert doc.metadata["user_id"] == "user-001"

    def test_no_projects_shows_none(self):
        user = UserDocument(
            user_id="u-2", name="Dave", email="d@x.com",
            role="Designer", projects=[],
        )
        doc = _user_to_document(user)
        assert "Projects: none" in doc.page_content


class TestProjectToDocument:
    def test_active_project(self, sample_project):
        doc = _project_to_document(sample_project)
        assert "Alpha" in doc.page_content
        assert "Charlie" in doc.page_content
        assert "Alice, Bob" in doc.page_content
        assert "Archived: No" in doc.page_content
        assert doc.metadata["is_archived"] == "False"

    def test_archived_project(self):
        project = ProjectDocument(
            project_id="p-2", name="Legacy", description="Old.",
            owner="Eve", members=[], is_archived=True,
        )
        doc = _project_to_document(project)
        assert "Archived: Yes" in doc.page_content
        assert doc.metadata["is_archived"] == "True"


class TestSprintToDocument:
    def test_with_start_and_end_dates(self, sample_sprint):
        doc = _sprint_to_document(sample_sprint)
        assert "2025-05-01" in doc.page_content
        assert "2025-05-14" in doc.page_content
        assert "4 done / 10 total" in doc.page_content
        assert doc.metadata["doc_type"] == "sprint"
        assert doc.metadata["sprint_id"] == "sprint-001"

    def test_with_only_start_date(self):
        sprint = SprintDocument(
            sprint_id="s-2", name="Sprint 2", project="P",
            status="active", start_date="2025-06-01", end_date=None,
        )
        doc = _sprint_to_document(sprint)
        assert "Started 2025-06-01" in doc.page_content

    def test_no_dates_shows_not_set(self):
        sprint = SprintDocument(
            sprint_id="s-3", name="Sprint 3", project="P",
            status="planned",
        )
        doc = _sprint_to_document(sprint)
        assert "Not set" in doc.page_content


# ===========================================================================
# Text extraction helpers
# ===========================================================================

class TestExtractTitleSimple:
    def test_finds_title_line(self):
        text = "[ISSUE] Project: Alpha\nTitle: My Issue\nLabels: bug"
        assert _extract_title_simple(text) == "My Issue"

    def test_no_title_line_returns_empty(self):
        text = "Some random text\nwithout any title"
        assert _extract_title_simple(text) == ""


class TestExtractExcerpt:
    def test_extracts_description(self):
        text = "Title: T\nDescription: This is the excerpt text."
        assert _extract_excerpt(text) == "This is the excerpt text."

    def test_extracts_content(self):
        text = "Path: X\nContent: Wiki body here."
        assert _extract_excerpt(text) == "Wiki body here."

    def test_truncates_at_200_chars(self):
        long_text = "Title: T\nDescription: " + "X" * 300
        result = _extract_excerpt(long_text)
        assert len(result) == 200

    def test_not_found_returns_empty(self):
        assert _extract_excerpt("No prefix here.") == ""


class TestExtractTitleFromDoc:
    def test_title_line_new_format(self):
        text = "Ticket: PROJ-1\nTitle: Fix crash\nAssignee: Alice"
        assert _extract_title_from_doc(text, {}, "ticket") == "Fix crash"

    def test_page_line_wiki_celery_format(self):
        text = "Page: Deployment Guide\nContent: ..."
        assert _extract_title_from_doc(text, {}, "wiki") == "Deployment Guide"

    def test_sprint_first_line_celery_format(self):
        text = "Sprint: Sprint 5 | 2025-05-01 to 2025-05-14\nProject: Alpha"
        assert _extract_title_from_doc(text, {}, "sprint") == "Sprint 5"

    def test_old_format_name_line(self):
        text = "[SPRINT] Name: Alpha Sprint\nProject: Alpha"
        assert _extract_title_from_doc(text, {}, "sprint") == "Alpha Sprint"

    def test_analytics_first_line(self):
        text = "Week of 2025-04-14. Project: Alpha"
        assert _extract_title_from_doc(text, {}, "analytics") == "Week of 2025-04-14. Project: Alpha"

    def test_metadata_fallback_title(self):
        text = "No recognized prefix here"
        meta = {"title": "Fallback Title"}
        assert _extract_title_from_doc(text, meta, "wiki") == "Fallback Title"

    def test_metadata_fallback_name(self):
        text = "No recognized prefix"
        meta = {"name": "Project Name"}
        assert _extract_title_from_doc(text, meta, "project") == "Project Name"

    def test_empty_text_returns_empty(self):
        result = _extract_title_from_doc("", {}, "issue")
        assert result == ""


class TestGetLogicalId:
    def test_issue_id(self):
        assert _get_logical_id({"issue_id": "abc-123"}) == "abc-123"

    def test_ticket_id_when_no_issue_id(self):
        assert _get_logical_id({"ticket_id": "PROJ-5"}) == "PROJ-5"

    def test_wiki_id(self):
        assert _get_logical_id({"wiki_id": "wiki-999"}) == "wiki-999"

    def test_page_id(self):
        assert _get_logical_id({"page_id": "page-007"}) == "page-007"

    def test_sprint_id(self):
        assert _get_logical_id({"sprint_id": "sprint-1"}) == "sprint-1"

    def test_user_id(self):
        assert _get_logical_id({"user_id": "user-42"}) == "user-42"

    def test_project_id(self):
        assert _get_logical_id({"project_id": "proj-7"}) == "proj-7"

    def test_empty_metadata_returns_empty(self):
        assert _get_logical_id({}) == ""

    def test_priority_order_issue_id_wins(self):
        meta = {"issue_id": "issue-1", "ticket_id": "PROJ-1"}
        assert _get_logical_id(meta) == "issue-1"


# ===========================================================================
# get_llm — factory tests (no real API calls)
# ===========================================================================

class TestGetLlm:
    @patch("app.services.rag_pipeline.get_settings")
    @patch("app.services.rag_pipeline.ChatOpenAI")
    def test_openai_rag_model(self, mock_openai_cls, mock_get_settings):
        settings = MagicMock()
        settings.use_groq = False
        settings.groq_api_key = ""
        settings.openai_api_key = "sk-test"
        settings.openai_model_rag = "gpt-4o-mini"
        settings.openai_max_tokens_rag = 1200
        mock_get_settings.return_value = settings

        get_llm(model_key="rag", json_mode=True)

        mock_openai_cls.assert_called_once()
        _, kwargs = mock_openai_cls.call_args
        assert kwargs["model"] == "gpt-4o-mini"
        assert kwargs["temperature"] == 0.2
        assert "response_format" in kwargs.get("model_kwargs", {})

    @patch("app.services.rag_pipeline.get_settings")
    @patch("app.services.rag_pipeline.ChatOpenAI")
    def test_openai_chat_model_no_json_mode(self, mock_openai_cls, mock_get_settings):
        settings = MagicMock()
        settings.use_groq = False
        settings.groq_api_key = ""
        settings.openai_api_key = "sk-test"
        settings.openai_model_chat = "gpt-4o"
        settings.openai_max_tokens_chat = 500
        mock_get_settings.return_value = settings

        get_llm(model_key="chat", json_mode=False)

        mock_openai_cls.assert_called_once()
        _, kwargs = mock_openai_cls.call_args
        assert kwargs["temperature"] == 0.7
        assert "model_kwargs" not in kwargs

    @patch("app.services.rag_pipeline.get_settings")
    def test_groq_used_when_configured(self, mock_get_settings):
        settings = MagicMock()
        settings.use_groq = True
        settings.groq_api_key = "gsk-test-key"
        settings.groq_model_rag = "llama3-8b-8192"
        mock_get_settings.return_value = settings

        with patch.dict("sys.modules", {"langchain_groq": MagicMock()}):
            import langchain_groq
            mock_groq_cls = MagicMock()
            langchain_groq.ChatGroq = mock_groq_cls

            get_llm(model_key="rag")
            mock_groq_cls.assert_called_once()


# ===========================================================================
# analyze_task_with_rag — mocked LLM + vector store
# ===========================================================================

class TestAnalyzeTaskWithRag:
    @patch("app.services.rag_pipeline.get_settings")
    @patch("app.services.rag_pipeline.get_vector_store")
    @patch("app.services.rag_pipeline.get_llm")
    @patch("app.services.rag_pipeline.PromptTemplate")
    def test_returns_parsed_json(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
        mock_rag_llm_response,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=10)

        # Vector store returns empty docs
        vs = MagicMock()
        vs.similarity_search.return_value = []
        mock_get_vs.return_value = vs

        # LLM chain returns the mock response
        mock_msg = MagicMock()
        mock_msg.content = json.dumps(mock_rag_llm_response)
        chain = MagicMock()
        chain.invoke.return_value = mock_msg

        prompt_instance = MagicMock()
        prompt_instance.__or__ = MagicMock(return_value=chain)
        mock_prompt_cls.return_value = prompt_instance

        mock_get_llm.return_value = MagicMock()

        result = analyze_task_with_rag(
            heading="Fix mobile login",
            description="Button missing on small screens.",
            labels=["bug", "frontend"],
        )

        assert result["story_points"] == 3.0
        assert result["recommended_team"]["Assigned To"] == "Alice"

    @patch("app.services.rag_pipeline.get_settings")
    @patch("app.services.rag_pipeline.get_vector_store")
    @patch("app.services.rag_pipeline.get_llm")
    @patch("app.services.rag_pipeline.PromptTemplate")
    def test_no_labels_uses_general(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
        mock_rag_llm_response,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=5)
        vs = MagicMock()
        vs.similarity_search.return_value = []
        mock_get_vs.return_value = vs

        mock_msg = MagicMock()
        mock_msg.content = json.dumps(mock_rag_llm_response)
        chain = MagicMock()
        chain.invoke.return_value = mock_msg

        prompt_instance = MagicMock()
        prompt_instance.__or__ = MagicMock(return_value=chain)
        mock_prompt_cls.return_value = prompt_instance
        mock_get_llm.return_value = MagicMock()

        result = analyze_task_with_rag("Task title", "Task description.", labels=[])
        # Query should have used "general" when no labels
        call_kwargs = vs.similarity_search.call_args
        assert "general" in call_kwargs[0][0]


# ===========================================================================
# analyze_issue_v2 — mocked LLM
# ===========================================================================

class TestAnalyzeIssueV2:
    @patch("app.services.rag_pipeline.get_settings")
    @patch("app.services.rag_pipeline.get_llm")
    @patch("app.services.rag_pipeline.PromptTemplate")
    def test_returns_parsed_json_with_sprint(
        self, mock_prompt_cls, mock_get_llm, mock_get_settings,
        mock_analyze_v2_response,
    ):
        mock_get_settings.return_value = MagicMock()

        mock_msg = MagicMock()
        mock_msg.content = json.dumps(mock_analyze_v2_response)
        chain = MagicMock()
        chain.invoke.return_value = mock_msg

        prompt_instance = MagicMock()
        prompt_instance.__or__ = MagicMock(return_value=chain)
        mock_prompt_cls.return_value = prompt_instance
        mock_get_llm.return_value = MagicMock()

        sprint = {"name": "Sprint 1", "status": "active", "goal": "Ship v2",
                  "todo": 3, "in_progress": 2, "review": 1, "done": 4}

        result = analyze_issue_v2(
            heading="Fix login crash",
            description="Crash on iOS 17.",
            project_labels=["bug", "frontend"],
            supported_issue_types=["bug", "task"],
            team_members=[{"name": "Alice", "role": "FE", "active_issues": 2, "sprint_issues": 1}],
            sprint_summary=sprint,
            similar_issues=[],
        )

        assert result["story_points"]["value"] == 2.0
        assert result["assignee"]["name"] == "Alice"

    @patch("app.services.rag_pipeline.get_settings")
    @patch("app.services.rag_pipeline.get_llm")
    @patch("app.services.rag_pipeline.PromptTemplate")
    def test_no_sprint_context(
        self, mock_prompt_cls, mock_get_llm, mock_get_settings,
        mock_analyze_v2_response,
    ):
        mock_get_settings.return_value = MagicMock()

        mock_msg = MagicMock()
        mock_msg.content = json.dumps(mock_analyze_v2_response)
        chain = MagicMock()
        chain.invoke.return_value = mock_msg

        prompt_instance = MagicMock()
        prompt_instance.__or__ = MagicMock(return_value=chain)
        mock_prompt_cls.return_value = prompt_instance
        mock_get_llm.return_value = MagicMock()

        result = analyze_issue_v2(
            heading="Add feature",
            description="New dashboard widget.",
            project_labels=[],
            supported_issue_types=["task"],
            team_members=[],
            sprint_summary=None,   # no sprint
            similar_issues=[],
        )

        # Sprint context line in the prompt should say "No active sprint."
        invoke_call = chain.invoke.call_args[0][0]
        assert "No active sprint." in invoke_call["sprint_context"]
        assert result["issue_type"]["value"] == "bug"


# ===========================================================================
# upsert_document — mocked vector store
# ===========================================================================

class TestUpsertDocument:
    @patch("app.services.rag_pipeline.get_vector_store")
    def test_deletes_then_reinserts(self, mock_get_vs):
        vs = MagicMock()
        vs._collection.get.return_value = {"ids": ["ticket_abc"]}
        mock_get_vs.return_value = vs

        upsert_document(
            doc_id="ticket_abc",
            text="Fix login crash on mobile",
            metadata={"type": "ticket", "project_id": "proj-1"},
        )

        vs._collection.delete.assert_called_once_with(ids=["ticket_abc"])
        vs.add_texts.assert_called_once_with(
            texts=["Fix login crash on mobile"],
            metadatas=[{"type": "ticket", "project_id": "proj-1"}],
            ids=["ticket_abc"],
        )

    @patch("app.services.rag_pipeline.get_vector_store")
    def test_no_delete_when_not_found(self, mock_get_vs):
        vs = MagicMock()
        vs._collection.get.return_value = {"ids": []}  # not found
        mock_get_vs.return_value = vs

        upsert_document("ticket_new", "Some text", {"type": "ticket"})

        vs._collection.delete.assert_not_called()
        vs.add_texts.assert_called_once()


# ===========================================================================
# query_chromadb — mocked vector store
# ===========================================================================

class TestQueryChromadb:
    def test_empty_doc_types_returns_empty(self):
        result = query_chromadb(
            query="anything", project_id=None, doc_types=[], top_k=5
        )
        assert result == []

    @patch("app.services.rag_pipeline.get_vector_store")
    @patch("app.services.hybrid_search.is_available", return_value=False)
    def test_single_type_filter_no_and_clause(self, _mock_bm25, mock_get_vs):
        """With one filter condition, use bare dict (not $and)."""
        vs = MagicMock()
        from langchain_core.documents import Document
        doc = Document(
            page_content="Title: Fix crash\nDescription: crash on iOS",
            metadata={"type": "ticket", "ticket_id": "PROJ-1", "project_id": "proj-1"},
        )
        vs.similarity_search.return_value = [doc]
        vs._collection.get.return_value = {"documents": [], "metadatas": []}
        mock_get_vs.return_value = vs

        result = query_chromadb(
            query="mobile crash", project_id=None, doc_types=["ticket"], top_k=3
        )

        # The where filter passed to similarity_search must be a bare dict
        _, call_kwargs = vs.similarity_search.call_args
        where = call_kwargs.get("filter") or vs.similarity_search.call_args[1].get("filter")
        assert "$and" not in where
        assert result[0]["type"] == "ticket"

    @patch("app.services.rag_pipeline.get_vector_store")
    @patch("app.services.hybrid_search.is_available", return_value=False)
    def test_project_and_sprint_build_and_clause(self, _mock_bm25, mock_get_vs):
        """project_id + sprint_id + type creates a $and filter."""
        vs = MagicMock()
        vs.similarity_search.return_value = []
        vs._collection.get.return_value = {"documents": [], "metadatas": []}
        mock_get_vs.return_value = vs

        query_chromadb(
            query="blocked issues",
            project_id="proj-1",
            doc_types=["ticket"],
            sprint_id="sprint-1",
            top_k=5,
        )

        _, call_kwargs = vs.similarity_search.call_args
        where = call_kwargs.get("filter")
        assert "$and" in where
        conditions = where["$and"]
        assert len(conditions) == 3

    @patch("app.services.rag_pipeline.get_vector_store")
    def test_exception_returns_empty_list(self, mock_get_vs):
        mock_get_vs.side_effect = RuntimeError("DB connection failed")
        result = query_chromadb("query", "proj-1", ["ticket"], top_k=5)
        assert result == []


# ===========================================================================
# semantic_search — mocked vector store
# ===========================================================================

class TestSemanticSearch:
    @patch("app.services.rag_pipeline.get_vector_store")
    @patch("app.services.hybrid_search.is_available", return_value=False)
    def test_pure_vector_search(self, _mock_bm25, mock_get_vs):
        from langchain_core.documents import Document
        doc = Document(
            page_content="[ISSUE] Project: Alpha\nTitle: Crash bug\nDescription: crash on start",
            metadata={"doc_type": "issue", "issue_id": "issue-1"},
        )
        vs = MagicMock()
        vs.similarity_search.return_value = [doc]
        vs._collection.get.return_value = {"documents": [], "metadatas": []}
        mock_get_vs.return_value = vs

        results = semantic_search("crash bug", k=5)

        assert len(results) == 1
        assert results[0]["type"] == "issue"
        assert results[0]["id"] == "issue-1"
        assert results[0]["title"] == "Crash bug"

    @patch("app.services.rag_pipeline.get_vector_store")
    @patch("app.services.hybrid_search.is_available", return_value=False)
    def test_non_issue_wiki_docs_excluded(self, _mock_bm25, mock_get_vs):
        from langchain_core.documents import Document
        user_doc = Document(
            page_content="[USER] Name: Alice",
            metadata={"doc_type": "user", "user_id": "u-1"},
        )
        vs = MagicMock()
        vs.similarity_search.return_value = [user_doc]
        vs._collection.get.return_value = {"documents": [], "metadatas": []}
        mock_get_vs.return_value = vs

        results = semantic_search("Alice", k=5)
        # User docs are not in _ISSUE_WIKI_TYPES — should be filtered out
        assert results == []

    @patch("app.services.rag_pipeline.get_vector_store")
    @patch("app.services.hybrid_search.is_available", return_value=False)
    def test_wiki_doc_returned(self, _mock_bm25, mock_get_vs):
        from langchain_core.documents import Document
        wiki_doc = Document(
            page_content="[WIKI] Project: Alpha\nTitle: API Docs\nContent: REST standards",
            metadata={"doc_type": "wiki", "wiki_id": "wiki-5"},
        )
        vs = MagicMock()
        vs.similarity_search.return_value = [wiki_doc]
        vs._collection.get.return_value = {"documents": [], "metadatas": []}
        mock_get_vs.return_value = vs

        results = semantic_search("REST", k=5)
        assert results[0]["type"] == "wiki"
        assert results[0]["id"] == "wiki-5"
