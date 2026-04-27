"""
Rule-based query classifier for the BrainBoard chatbot.

classify_query(query, page) → dict

Returns three keys that tell ChatbotQueryView what to fetch in parallel:

    needs_chromadb : bool       True when the answer likely requires vector search
    doc_types      : list[str]  ChromaDB ``type`` values to include in the filter,
                                 e.g. ["ticket", "wiki", "sprint"]
    sql_queries    : list[str]  Named DB helpers to run in addition to page_context.
                                 Currently supported: ["bandwidth"]

Design principles
─────────────────
* Pure Python — zero DB / network calls.  Runs in the Django request thread before
  the ThreadPoolExecutor is started so its result can drive what the two workers do.
* Keyword matching uses word-boundary regex so "sprint" in "sprint_id" doesn't fire.
* Falls back to a broad multi-type search when nothing explicit matches — better to
  over-retrieve than to return an empty answer.
"""
from __future__ import annotations

import re

# ---------------------------------------------------------------------------
# Keyword sets  (lowercase, stripped, multi-word phrases work via regex)
# ---------------------------------------------------------------------------

_BANDWIDTH_KEYWORDS = frozenset({
    "bandwidth", "capacity", "workload", "overloaded", "overload",
    "who has time", "who is free", "who is available", "available",
    "busy", "load", "how many tasks", "how many tickets", "how many issues",
})

_WIKI_KEYWORDS = frozenset({
    "wiki", "documentation", "doc", "docs", "guide", "how to", "how do",
    "process", "procedure", "policy", "onboarding", "readme", "runbook",
    "spec", "specification", "knowledge base",
})

_SPRINT_KEYWORDS = frozenset({
    "sprint", "velocity", "burndown", "burn down", "points burned",
    "story points", "this sprint", "active sprint", "sprint progress",
    "sprint status", "sprint health",
})

_ANALYTICS_KEYWORDS = frozenset({
    "analytics", "trend", "trends", "weekly", "cycle time",
    "throughput", "closed last", "created last", "last week", "this week",
    "velocity over", "average cycle", "week over week",
})

_TICKET_KEYWORDS = frozenset({
    "ticket", "issue", "task", "bug", "story", "feature", "subtask",
    "blocked", "blocking", "critical", "high priority", "in progress",
    "todo", "to do", "done", "review", "assignee", "assigned",
    "unassigned", "open ticket", "open issue",
})

_PROJECT_KEYWORDS = frozenset({
    "project", "projects", "team", "members", "member",
    "who is on", "who works on", "project details",
})

# Pages that require certain doc types regardless of query keywords
_PAGE_TO_DOC_TYPES: dict[str, list[str]] = {
    "kanban":    ["ticket", "sprint"],
    "backlog":   ["ticket"],
    "wiki":      ["wiki"],
    "analytics": ["analytics"],
    "dashboard": ["project", "ticket"],
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def classify_query(query: str, page: str | None = None) -> dict:
    """
    Classify a user query and return retrieval hints for ChatbotQueryView.

    Args:
        query: Raw user query string.
        page:  Current UI page ("kanban" | "backlog" | "wiki" | "analytics" |
               "dashboard").  May be None or empty string.

    Returns:
        {
            "needs_chromadb": bool,
            "doc_types":      list[str],
            "sql_queries":    list[str],
        }
    """
    q = query.lower().strip()
    page = (page or "").lower().strip()

    doc_types: list[str] = []
    sql_queries: list[str] = []

    # ── SQL helpers ────────────────────────────────────────────────────────
    if _any_keyword(q, _BANDWIDTH_KEYWORDS):
        sql_queries.append("bandwidth")

    # ── Doc types from page context ────────────────────────────────────────
    if page in _PAGE_TO_DOC_TYPES:
        for dt in _PAGE_TO_DOC_TYPES[page]:
            _add_unique(doc_types, dt)

    # ── Doc types from query keywords ─────────────────────────────────────
    if _any_keyword(q, _WIKI_KEYWORDS):
        _add_unique(doc_types, "wiki")

    if _any_keyword(q, _SPRINT_KEYWORDS):
        _add_unique(doc_types, "sprint")

    if _any_keyword(q, _ANALYTICS_KEYWORDS):
        _add_unique(doc_types, "analytics")

    if _any_keyword(q, _TICKET_KEYWORDS):
        _add_unique(doc_types, "ticket")

    if _any_keyword(q, _PROJECT_KEYWORDS):
        _add_unique(doc_types, "project")

    # Bandwidth questions pair with user docs when no other type matched
    if "bandwidth" in sql_queries and not doc_types:
        _add_unique(doc_types, "user")

    # ── Fallback: broad search when nothing specific was detected ──────────
    if not doc_types:
        doc_types = ["ticket", "wiki", "sprint", "project"]

    needs_chromadb = bool(doc_types)

    return {
        "needs_chromadb": needs_chromadb,
        "doc_types": doc_types,
        "sql_queries": sql_queries,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _any_keyword(text: str, keywords: frozenset) -> bool:
    """True if any keyword (phrase) appears as a word-boundary match in text."""
    for kw in keywords:
        pattern = r"\b" + re.escape(kw) + r"\b"
        if re.search(pattern, text):
            return True
    return False


def _add_unique(lst: list, item: str) -> None:
    """Append item to list only if not already present (preserves order)."""
    if item not in lst:
        lst.append(item)
