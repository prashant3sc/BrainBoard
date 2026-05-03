from django.db.models import Count

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project
from wiki.filters import WikiPageFilter
from wiki.models import TicketPageLink, WikiPage, WikiPageVersion, WikiSpace
from wiki.serializers import (
    IssueWikiLinkSerializer,
    TicketPageLinkSerializer,
    WikiPageCreateSerializer,
    WikiPageSerializer,
    WikiPageUpdateSerializer,
    WikiPageVersionSerializer,
)


class ProjectWikiListView(APIView):
    """
    GET /projects/:projectId/wiki — list wiki pages for a project.

    Filters:
      ?space_id=<uuid>      filter by wiki space
      ?parent_id=<uuid>     filter by parent page (direct children)
      ?root_only=true       only top-level pages (parent=null)
      ?search=text          title/content search
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        queryset = WikiPage.objects.filter(project=project)
        filterset = WikiPageFilter(request.query_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs
        return Response(WikiPageSerializer(queryset, many=True).data)


class WikiPageListView(APIView):
    """
    GET  /wiki — list all wiki pages accessible to the requesting user.
                 Admin sees all; others see only pages in projects they belong to.
    POST /wiki — create a wiki page (admin, pm, developer)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from projects.models import ProjectMember
        if request.user.is_org_admin:
            queryset = WikiPage.objects.all().select_related("project")
        else:
            member_project_ids = ProjectMember.objects.filter(
                user=request.user
            ).values_list("project_id", flat=True)
            queryset = WikiPage.objects.filter(
                project_id__in=member_project_ids
            ).select_related("project")
        filterset = WikiPageFilter(request.query_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs
        return Response(WikiPageSerializer(queryset, many=True).data)

    def post(self, request):
        if not request.user.can_write_wiki:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = WikiPageCreateSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        page = serializer.save()
        return Response(WikiPageSerializer(page).data, status=status.HTTP_201_CREATED)


class WikiPageDetailView(APIView):
    """
    GET    /wiki/:id
    PATCH  /wiki/:id — update (admin, pm, developer)
    DELETE /wiki/:id — cascades to sub-pages (admin, pm)
    """

    permission_classes = [IsAuthenticated]

    def _get_page(self, pk):
        try:
            return WikiPage.objects.get(pk=pk)
        except WikiPage.DoesNotExist:
            return None

    def get(self, request, pk):
        page = self._get_page(pk)
        if not page:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(WikiPageSerializer(page).data)

    def patch(self, request, pk):
        page = self._get_page(pk)
        if not page:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.can_write_wiki:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = WikiPageUpdateSerializer(page, data=request.data, partial=True, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        page = serializer.save()
        return Response(WikiPageSerializer(page).data)

    def delete(self, request, pk):
        page = self._get_page(pk)
        if not page:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        # CASCADE is handled by the DB (parent FK with on_delete=CASCADE on children)
        page.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WikiPageHistoryView(APIView):
    """
    GET /wiki/:id/history — version history for a page
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            page = WikiPage.objects.get(pk=pk)
        except WikiPage.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        versions = WikiPageVersion.objects.filter(page=page).order_by("-version_number")
        return Response(WikiPageVersionSerializer(versions, many=True).data)


class TicketPageLinkView(APIView):
    """
    POST   /wiki/:id/link-ticket  — link an issue to this wiki page
    DELETE /wiki/:id/link-ticket  — unlink
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            page = WikiPage.objects.get(pk=pk)
        except WikiPage.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        links = TicketPageLink.objects.filter(wiki_page=page).select_related("issue")
        return Response(TicketPageLinkSerializer(links, many=True).data)

    def post(self, request, pk):
        try:
            page = WikiPage.objects.get(pk=pk)
        except WikiPage.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        from issues.models import Issue

        issue_id = request.data.get("issueId")
        if not issue_id:
            return Response({"detail": "issueId required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            issue = Issue.objects.get(pk=issue_id)
        except Issue.DoesNotExist:
            return Response({"detail": "Issue not found"}, status=status.HTTP_404_NOT_FOUND)

        link, _ = TicketPageLink.objects.get_or_create(
            issue=issue, wiki_page=page, defaults={"linked_by": request.user}
        )
        return Response(TicketPageLinkSerializer(link).data, status=status.HTTP_201_CREATED)

    def delete(self, request, pk):
        try:
            page = WikiPage.objects.get(pk=pk)
        except WikiPage.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        from issues.models import Issue

        issue_id = request.data.get("issueId")
        if not issue_id:
            return Response({"detail": "issueId required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            issue = Issue.objects.get(pk=issue_id)
        except Issue.DoesNotExist:
            return Response({"detail": "Issue not found"}, status=status.HTTP_404_NOT_FOUND)

        deleted, _ = TicketPageLink.objects.filter(issue=issue, wiki_page=page).delete()
        if not deleted:
            return Response({"detail": "Link not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssueWikiLinksView(APIView):
    """GET /issues/<pk>/wiki-links — all wiki pages linked to an issue."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from issues.models import Issue
        try:
            issue = Issue.objects.get(pk=pk)
        except Issue.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        links = TicketPageLink.objects.filter(issue=issue).select_related("wiki_page")
        return Response(IssueWikiLinkSerializer(links, many=True).data)


class KBAnalyticsView(APIView):
    """
    GET /projects/<project_id>/analytics/kb

    Returns KB usage analytics: page counts, edit activity, top pages, and top contributors.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        pages = WikiPage.objects.filter(project=project)
        total_pages = pages.count()

        versions = WikiPageVersion.objects.filter(page__project=project)
        total_edits = versions.count()

        total_links = TicketPageLink.objects.filter(wiki_page__project=project).count()

        # Edits + page count per space
        spaces = WikiSpace.objects.filter(project=project).annotate(page_count=Count("pages", distinct=True))
        spaces_data = []
        for space in spaces:
            edit_count = versions.filter(page__space=space).count()
            spaces_data.append({
                "space_id": str(space.id),
                "name": space.name,
                "page_count": space.page_count,
                "edit_count": edit_count,
            })
        no_space_pages = pages.filter(space__isnull=True)
        if no_space_pages.exists():
            spaces_data.append({
                "space_id": None,
                "name": "No Space",
                "page_count": no_space_pages.count(),
                "edit_count": versions.filter(page__space__isnull=True).count(),
            })

        # Top pages by edit count
        top_pages_qs = (
            pages
            .annotate(edit_count=Count("versions", distinct=True), link_count=Count("issue_links", distinct=True))
            .order_by("-edit_count")[:10]
        )
        top_pages_data = [
            {
                "page_id": str(p.id),
                "title": p.title,
                "edit_count": p.edit_count,
                "link_count": p.link_count,
                "updated_at": str(p.updated_at.date()),
            }
            for p in top_pages_qs
        ]

        # Top contributors by version count
        contributor_qs = (
            versions
            .filter(created_by__isnull=False)
            .values("created_by", "created_by__email", "created_by__first_name", "created_by__last_name", "created_by__username")
            .annotate(edit_count=Count("id"))
            .order_by("-edit_count")[:10]
        )
        top_contributors = [
            {
                "user_id": str(c["created_by"]),
                "name": (
                    f"{c['created_by__first_name']} {c['created_by__last_name']}".strip()
                    or c["created_by__username"]
                    or c["created_by__email"]
                ),
                "edit_count": c["edit_count"],
            }
            for c in contributor_qs
        ]

        # Recent activity (last 10 edits)
        recent_versions = versions.select_related("page", "created_by").order_by("-created_at")[:10]
        recent_activity = [
            {
                "page_id": str(v.page.id),
                "title": v.page.title,
                "version_number": v.version_number,
                "user": (
                    v.created_by.get_full_name() or v.created_by.username
                    if v.created_by else "Unknown"
                ),
                "date": str(v.created_at.date()),
            }
            for v in recent_versions
        ]

        return Response({
            "project_id": str(project.id),
            "total_pages": total_pages,
            "total_edits": total_edits,
            "total_links": total_links,
            "spaces": spaces_data,
            "top_pages": top_pages_data,
            "top_contributors": top_contributors,
            "recent_activity": recent_activity,
        })
