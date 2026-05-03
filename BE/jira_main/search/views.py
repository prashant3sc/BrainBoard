"""
Search views: basic full-text (icontains) and semantic (vector via AI service).
"""

import requests
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from ai_integration import ai_client
from issues.models import Issue
from wiki.models import WikiPage

EXCERPT_LEN = 200


def _excerpt(text, query):
    """Return a short excerpt of text around the first match of query."""
    lower = text.lower()
    idx = lower.find(query.lower())
    if idx == -1:
        return text[:EXCERPT_LEN]
    start = max(0, idx - 60)
    end = min(len(text), idx + EXCERPT_LEN - 60)
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet


class SearchView(APIView):
    """
    GET  /search?q=<query>        — full-text search via query param
    POST /search { "query": "..." } — full-text search via request body
    Returns a flat array of SearchResult objects (type: "issue" | "wiki").
    """

    permission_classes = [IsAuthenticated]

    def _run_search(self, query):
        """Shared search logic used by both GET and POST."""
        if not query:
            return []
        results = []
        issues = Issue.objects.filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        ).select_related("project")[:20]
        for issue in issues:
            results.append({
                "id":        str(issue.pk),
                "type":      "issue",
                "title":     issue.title,
                "excerpt":   _excerpt(issue.description or issue.title, query),
                "projectId": str(issue.project_id),
            })
        pages = WikiPage.objects.filter(
            Q(title__icontains=query) | Q(content__icontains=query)
        ).select_related("project")[:20]
        for page in pages:
            results.append({
                "id":        str(page.pk),
                "type":      "wiki",
                "title":     page.title,
                "excerpt":   _excerpt(page.content or page.title, query),
                "projectId": str(page.project_id),
            })
        return results

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        return Response(self._run_search(query))

    def post(self, request):
        query = request.data.get("query", "").strip()
        return Response(self._run_search(query))


class SemanticSearchView(APIView):
    """
    GET  /search/semantic?q=<query>       — vector similarity search via query param
    POST /search/semantic { "query": "..." } — vector similarity search via request body
    Calls the AI service for vector similarity search, then enriches each result
    with the projectId from Postgres before returning.
    """

    permission_classes = [IsAuthenticated]

    def _run_semantic_search(self, query, request):
        """Shared semantic search logic used by both GET and POST."""
        if not query:
            return Response([])
        try:
            raw_results = ai_client.semantic_search(query)
        except requests.RequestException as exc:
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        issue_ids = [r["id"] for r in raw_results if r.get("type") == "issue" and r.get("id")]
        wiki_ids  = [r["id"] for r in raw_results if r.get("type") == "wiki"  and r.get("id")]
        issue_map = {
            str(i.pk): str(i.project_id)
            for i in Issue.objects.filter(pk__in=issue_ids).only("id", "project_id")
        }
        wiki_map = {
            str(p.pk): str(p.project_id)
            for p in WikiPage.objects.filter(pk__in=wiki_ids).only("id", "project_id")
        }
        enriched = []
        for item in raw_results:
            item_id   = item.get("id", "")
            item_type = item.get("type", "")
            if item_type == "issue" and item_id in issue_map:
                enriched.append({
                    "id":        item_id,
                    "type":      "issue",
                    "title":     item.get("title", ""),
                    "excerpt":   item.get("excerpt", ""),
                    "projectId": issue_map[item_id],
                })
            elif item_type == "wiki" and item_id in wiki_map:
                enriched.append({
                    "id":        item_id,
                    "type":      "wiki",
                    "title":     item.get("title", ""),
                    "excerpt":   item.get("excerpt", ""),
                    "projectId": wiki_map[item_id],
                })
        return Response(enriched)

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        return self._run_semantic_search(query, request)

    def post(self, request):
        query = request.data.get("query", "").strip()
        return self._run_semantic_search(query, request)
