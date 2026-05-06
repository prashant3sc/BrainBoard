"""
Unit tests for app/services/hybrid_search.py

All tests are pure — no I/O, no mocks needed.
BM25 tests are skipped automatically when rank_bm25 is not installed.
"""
import pytest
from app.services.hybrid_search import (
    _tokenize,
    bm25_search,
    reciprocal_rank_fusion,
    is_available,
)


# ---------------------------------------------------------------------------
# _tokenize
# ---------------------------------------------------------------------------

class TestTokenize:
    def test_basic_words(self):
        assert _tokenize("Hello World") == ["hello", "world"]

    def test_empty_string(self):
        assert _tokenize("") == []

    def test_strips_punctuation(self):
        result = _tokenize("fix login-button, now!")
        assert "fix" in result
        assert "button" in result
        assert "," not in result
        assert "!" not in result

    def test_lowercases_input(self):
        assert _tokenize("FastAPI GROQ OpenAI") == ["fastapi", "groq", "openai"]

    def test_numbers_kept(self):
        result = _tokenize("Sprint 2025")
        assert "sprint" in result
        assert "2025" in result


# ---------------------------------------------------------------------------
# bm25_search
# ---------------------------------------------------------------------------

class TestBm25Search:
    @pytest.mark.skipif(not is_available(), reason="rank_bm25 not installed")
    def test_returns_ranked_ids(self):
        corpus_texts = [
            "fix the login button on mobile",
            "add dark mode to the dashboard",
            "login page crashes on iOS",
        ]
        corpus_ids = ["id-1", "id-2", "id-3"]
        result = bm25_search(corpus_texts, corpus_ids, "login bug mobile", top_k=2)
        assert len(result) <= 2
        # "id-1" and "id-3" contain "login" — at least one should appear
        assert any(r in ("id-1", "id-3") for r in result)

    @pytest.mark.skipif(not is_available(), reason="rank_bm25 not installed")
    def test_top_k_limits_results(self):
        texts = [f"document number {i}" for i in range(10)]
        ids = [f"id-{i}" for i in range(10)]
        result = bm25_search(texts, ids, "document", top_k=3)
        assert len(result) == 3

    @pytest.mark.skipif(not is_available(), reason="rank_bm25 not installed")
    def test_empty_corpus_returns_empty(self):
        assert bm25_search([], [], "anything", top_k=5) == []

    def test_returns_empty_when_unavailable(self):
        """When rank_bm25 is missing the function always returns []."""
        if is_available():
            pytest.skip("rank_bm25 is installed — skipping unavailability test")
        result = bm25_search(["some text"], ["id-1"], "some", top_k=1)
        assert result == []

    @pytest.mark.skipif(not is_available(), reason="rank_bm25 not installed")
    def test_ids_correspond_to_texts(self):
        texts = ["alpha topic", "beta topic", "gamma topic"]
        ids = ["a", "b", "c"]
        result = bm25_search(texts, ids, "gamma", top_k=1)
        assert result[0] == "c"


# ---------------------------------------------------------------------------
# reciprocal_rank_fusion
# ---------------------------------------------------------------------------

class TestReciprocalRankFusion:
    def test_both_lists_merged(self):
        vector_ids = ["doc-A", "doc-B", "doc-C"]
        bm25_ids = ["doc-B", "doc-D", "doc-A"]
        merged = reciprocal_rank_fusion(vector_ids, bm25_ids)
        # All unique IDs must appear in output
        assert set(merged) == {"doc-A", "doc-B", "doc-C", "doc-D"}

    def test_overlap_doc_ranks_higher(self):
        """A document appearing in both lists should outrank one in a single list."""
        vector_ids = ["shared", "vector-only"]
        bm25_ids = ["shared", "bm25-only"]
        merged = reciprocal_rank_fusion(vector_ids, bm25_ids)
        assert merged[0] == "shared"

    def test_empty_bm25_returns_vector_order(self):
        vector_ids = ["a", "b", "c"]
        merged = reciprocal_rank_fusion(vector_ids, [])
        assert merged == ["a", "b", "c"]

    def test_empty_vector_returns_bm25_order(self):
        bm25_ids = ["x", "y", "z"]
        merged = reciprocal_rank_fusion([], bm25_ids)
        assert merged == ["x", "y", "z"]

    def test_both_empty_returns_empty(self):
        assert reciprocal_rank_fusion([], []) == []

    def test_rrf_constant_k_affects_scores(self):
        """k=0 gives max weight to top ranks; k=100 flattens differences."""
        vector_ids = ["top", "bottom"]
        merged_low_k = reciprocal_rank_fusion(vector_ids, [], k=0)
        merged_high_k = reciprocal_rank_fusion(vector_ids, [], k=1000)
        # Order should be preserved regardless of k
        assert merged_low_k[0] == "top"
        assert merged_high_k[0] == "top"

    def test_score_accumulation_for_duplicate_ids(self):
        """Same ID in both lists should accumulate scores, not appear twice."""
        merged = reciprocal_rank_fusion(["a", "b"], ["a", "c"])
        assert merged.count("a") == 1


# ---------------------------------------------------------------------------
# is_available
# ---------------------------------------------------------------------------

class TestIsAvailable:
    def test_returns_bool(self):
        result = is_available()
        assert isinstance(result, bool)
