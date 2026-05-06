"""
Tests for app/services/chat_service.py

All ChromaDB and LLM calls are mocked — no API keys or database needed.
"""
import json
from unittest.mock import MagicMock, patch

import pytest
from langchain_core.documents import Document

from app.schemas import WikiContextPayload
from app.services.chat_service import chat_with_rag


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_chain(response_dict: dict) -> MagicMock:
    """Return a mock LangChain chain whose .invoke() returns response_dict as JSON."""
    msg = MagicMock()
    msg.content = json.dumps(response_dict)
    chain = MagicMock()
    chain.invoke.return_value = msg
    return chain


def _make_prompt_and_chain(response_dict: dict):
    """Return (mock_prompt_instance, mock_chain) where prompt | llm = chain."""
    chain = _make_chain(response_dict)
    prompt = MagicMock()
    prompt.__or__ = MagicMock(return_value=chain)
    return prompt, chain


# ---------------------------------------------------------------------------
# Standard workspace-wide mode
# ---------------------------------------------------------------------------

class TestChatWithRagStandardMode:
    @patch("app.services.chat_service.get_settings")
    @patch("app.services.chat_service.get_vector_store")
    @patch("app.services.chat_service.get_llm")
    @patch("app.services.chat_service.PromptTemplate")
    def test_returns_answer_and_sources(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
        mock_chat_response,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=5)

        doc = Document(
            page_content="Title: Sprint Board\nSome sprint data.",
            metadata={"project": "alpha"},
        )
        vs = MagicMock()
        vs.similarity_search.return_value = [doc]
        mock_get_vs.return_value = vs

        prompt, chain = _make_prompt_and_chain(mock_chat_response)
        mock_prompt_cls.return_value = prompt
        mock_get_llm.return_value = MagicMock()

        result = chat_with_rag("How many open bugs?")

        assert result["answer"] == "There are 3 open bugs in project Alpha."
        assert result["out_of_scope"] is False

    @patch("app.services.chat_service.get_settings")
    @patch("app.services.chat_service.get_vector_store")
    @patch("app.services.chat_service.get_llm")
    @patch("app.services.chat_service.PromptTemplate")
    def test_project_scoped_docs_prioritized(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=3)

        alpha_doc = Document(
            page_content="Title: Alpha Issue\n",
            metadata={"project": "Alpha"},
        )
        other_doc = Document(
            page_content="Title: Other Issue\n",
            metadata={"project": "Beta"},
        )
        vs = MagicMock()
        vs.similarity_search.return_value = [other_doc, alpha_doc]
        mock_get_vs.return_value = vs

        response_dict = {"answer": "ok", "sources": [], "out_of_scope": False}
        prompt, chain = _make_prompt_and_chain(response_dict)
        mock_prompt_cls.return_value = prompt
        mock_get_llm.return_value = MagicMock()

        chat_with_rag("sprint status", project_name="Alpha")

        # Verify that the search query included the project name
        search_call_args = vs.similarity_search.call_args[0]
        assert "Alpha" in search_call_args[0]

    @patch("app.services.chat_service.get_settings")
    @patch("app.services.chat_service.get_vector_store")
    @patch("app.services.chat_service.get_llm")
    @patch("app.services.chat_service.PromptTemplate")
    def test_workspace_context_prepended_to_context(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=5)
        vs = MagicMock()
        vs.similarity_search.return_value = []
        mock_get_vs.return_value = vs

        response_dict = {"answer": "Got it", "sources": [], "out_of_scope": False}
        prompt, chain = _make_prompt_and_chain(response_dict)
        mock_prompt_cls.return_value = prompt
        mock_get_llm.return_value = MagicMock()

        chat_with_rag("what is X?", workspace_context="Active sprint: Sprint 5")

        invoke_kwargs = chain.invoke.call_args[0][0]
        assert "Active sprint: Sprint 5" in invoke_kwargs["context"]

    @patch("app.services.chat_service.get_settings")
    @patch("app.services.chat_service.get_vector_store")
    @patch("app.services.chat_service.get_llm")
    @patch("app.services.chat_service.PromptTemplate")
    def test_no_docs_shows_no_relevant_data(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=5)
        vs = MagicMock()
        vs.similarity_search.return_value = []
        mock_get_vs.return_value = vs

        response_dict = {"answer": "No data found.", "sources": [], "out_of_scope": False}
        prompt, chain = _make_prompt_and_chain(response_dict)
        mock_prompt_cls.return_value = prompt
        mock_get_llm.return_value = MagicMock()

        chat_with_rag("show me all issues")

        invoke_kwargs = chain.invoke.call_args[0][0]
        assert "No relevant data found" in invoke_kwargs["context"]


# ---------------------------------------------------------------------------
# Wiki-page mode
# ---------------------------------------------------------------------------

class TestChatWithRagWikiMode:
    @patch("app.services.chat_service.get_settings")
    @patch("app.services.chat_service.get_vector_store")
    @patch("app.services.chat_service.get_llm")
    @patch("app.services.chat_service.PromptTemplate")
    def test_wiki_prompt_template_used(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=5)
        vs = MagicMock()
        vs.similarity_search.return_value = []
        mock_get_vs.return_value = vs

        response_dict = {
            "answer": "The API uses REST.",
            "sources": ["API Design Guidelines"],
            "out_of_scope": False,
        }
        prompt, chain = _make_prompt_and_chain(response_dict)
        mock_prompt_cls.return_value = prompt
        mock_get_llm.return_value = MagicMock()

        wiki_ctx = WikiContextPayload(
            title="API Design Guidelines",
            text="All endpoints return JSON.",
        )
        result = chat_with_rag("What format do endpoints return?", wiki_context=wiki_ctx)

        # In wiki mode, input_variables must include page_title / page_text
        prompt_ctor_kwargs = mock_prompt_cls.call_args[1]
        assert "page_title" in prompt_ctor_kwargs.get("input_variables", [])
        assert result["answer"] == "The API uses REST."

    @patch("app.services.chat_service.get_settings")
    @patch("app.services.chat_service.get_vector_store")
    @patch("app.services.chat_service.get_llm")
    @patch("app.services.chat_service.PromptTemplate")
    def test_wiki_source_title_is_page_title(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=5)
        vs = MagicMock()
        vs.similarity_search.return_value = []
        mock_get_vs.return_value = vs

        # LLM returns empty sources — should be filled with page title
        response_dict = {"answer": "OK", "sources": [], "out_of_scope": False}
        prompt, chain = _make_prompt_and_chain(response_dict)
        mock_prompt_cls.return_value = prompt
        mock_get_llm.return_value = MagicMock()

        wiki_ctx = WikiContextPayload(title="Sprint Guide", text="Sprint lasts 2 weeks.")
        result = chat_with_rag("How long is a sprint?", wiki_context=wiki_ctx)

        assert "Sprint Guide" in result["sources"]


# ---------------------------------------------------------------------------
# Error handling — non-JSON LLM response
# ---------------------------------------------------------------------------

class TestChatWithRagJsonError:
    @patch("app.services.chat_service.get_settings")
    @patch("app.services.chat_service.get_vector_store")
    @patch("app.services.chat_service.get_llm")
    @patch("app.services.chat_service.PromptTemplate")
    def test_invalid_json_returns_fallback(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=5)
        vs = MagicMock()
        vs.similarity_search.return_value = []
        mock_get_vs.return_value = vs

        # LLM returns non-JSON
        bad_msg = MagicMock()
        bad_msg.content = "This is not JSON at all"
        chain = MagicMock()
        chain.invoke.return_value = bad_msg
        prompt = MagicMock()
        prompt.__or__ = MagicMock(return_value=chain)
        mock_prompt_cls.return_value = prompt
        mock_get_llm.return_value = MagicMock()

        result = chat_with_rag("What is the sprint status?")

        assert "Sorry" in result["answer"]
        assert result["out_of_scope"] is False
        assert result["sources"] == []


# ---------------------------------------------------------------------------
# Source title extraction from ChromaDB documents
# ---------------------------------------------------------------------------

class TestChatSourceExtraction:
    @patch("app.services.chat_service.get_settings")
    @patch("app.services.chat_service.get_vector_store")
    @patch("app.services.chat_service.get_llm")
    @patch("app.services.chat_service.PromptTemplate")
    def test_sources_extracted_from_title_lines(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=5)

        doc = Document(
            page_content="Title: My Epic Issue\nDescription: Something broken.",
            metadata={"project": "Alpha"},
        )
        vs = MagicMock()
        vs.similarity_search.return_value = [doc]
        mock_get_vs.return_value = vs

        # LLM returns no sources — fallback should extract from docs
        response_dict = {"answer": "Details found.", "sources": [], "out_of_scope": False}
        prompt, chain = _make_prompt_and_chain(response_dict)
        mock_prompt_cls.return_value = prompt
        mock_get_llm.return_value = MagicMock()

        result = chat_with_rag("Tell me about this issue")
        assert "My Epic Issue" in result["sources"]

    @patch("app.services.chat_service.get_settings")
    @patch("app.services.chat_service.get_vector_store")
    @patch("app.services.chat_service.get_llm")
    @patch("app.services.chat_service.PromptTemplate")
    def test_llm_sources_not_overwritten_when_present(
        self, mock_prompt_cls, mock_get_llm, mock_get_vs, mock_get_settings,
    ):
        mock_get_settings.return_value = MagicMock(chroma_retrieval_k=5)
        vs = MagicMock()
        vs.similarity_search.return_value = []
        mock_get_vs.return_value = vs

        # LLM already returns sources
        response_dict = {
            "answer": "Sprint is active.",
            "sources": ["Sprint Board"],
            "out_of_scope": False,
        }
        prompt, chain = _make_prompt_and_chain(response_dict)
        mock_prompt_cls.return_value = prompt
        mock_get_llm.return_value = MagicMock()

        result = chat_with_rag("sprint status")
        # Should keep the LLM's sources, not overwrite
        assert result["sources"] == ["Sprint Board"]
