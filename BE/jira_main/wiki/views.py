from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project
from wiki.filters import WikiPageFilter
from wiki.models import TicketPageLink, WikiPage, WikiPageVersion
from wiki.serializers import (
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
    POST /wiki — create a wiki page (admin, pm, developer)
    """

    permission_classes = [IsAuthenticated]

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
