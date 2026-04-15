"""
Basic full-text search across Issues and WikiPages.
For semantic/vector search the DS team will expose a FastAPI endpoint;
this view does a DB-level icontains search as the fallback/stub.
"""

from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
    POST /search
    Body: { "query": "csv export" }
    Returns a flat array of SearchResult objects (type: "issue" | "wiki").
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        query = request.data.get("query", "").strip()
        if not query:
            return Response([])

        results = []

        # Search issues
        issues = Issue.objects.filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        ).select_related("project")[:20]

        for issue in issues:
            results.append(
                {
                    "id": str(issue.pk),
                    "type": "issue",
                    "title": issue.title,
                    "excerpt": _excerpt(issue.description or issue.title, query),
                    "projectId": str(issue.project_id),
                }
            )

        # Search wiki pages
        pages = WikiPage.objects.filter(
            Q(title__icontains=query) | Q(content__icontains=query)
        ).select_related("project")[:20]

        for page in pages:
            results.append(
                {
                    "id": str(page.pk),
                    "type": "wiki",
                    "title": page.title,
                    "excerpt": _excerpt(page.content or page.title, query),
                    "projectId": str(page.project_id),
                }
            )

        return Response(results)
