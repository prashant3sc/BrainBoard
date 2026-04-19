from django.db.models import Count, Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from issues.filters import IssueFilter
from issues.models import Issue, Label
from issues.serializers import (
    IssueCreateSerializer,
    IssueSerializer,
    IssueUpdateSerializer,
    LabelSerializer,
)
from projects.models import Project


def annotate_issues(queryset):
    """Attach subtask_count and done_subtask_count to each issue in a single DB pass."""
    return queryset.annotate(
        subtask_count=Count("subtasks"),
        done_subtask_count=Count("subtasks", filter=Q(subtasks__status=Issue.DONE)),
    )


class ProjectIssueListView(APIView):
    """
    GET /projects/:projectId/issues — list issues for a project.

    Filters:
      ?status=todo|in_progress|review|done
      ?priority=critical|high|medium|low
      ?assignee_id=<uuid>
      ?sprint_id=<uuid>
      ?backlog=true             (sprint is null)
      ?label_id=<uuid>
      ?search=text
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        queryset = annotate_issues(
            Issue.objects.filter(project=project).select_related("assignee", "reporter")
        )
        filterset = IssueFilter(request.query_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs
        return Response(IssueSerializer(queryset, many=True).data)


class IssueListView(APIView):
    """
    POST /issues — create a new issue (admin, pm, developer)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request.user.can_create_issues:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = IssueCreateSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        issue = serializer.save()
        issue = annotate_issues(Issue.objects.filter(pk=issue.pk)).first()
        return Response(IssueSerializer(issue).data, status=status.HTTP_201_CREATED)


class IssueDetailView(APIView):
    """
    GET    /issues/:id
    PATCH  /issues/:id — edit (admin, pm, developer; developer limited to own/assigned)
    DELETE /issues/:id — admin, pm only
    """

    permission_classes = [IsAuthenticated]

    def _get_issue(self, pk):
        return annotate_issues(Issue.objects.filter(pk=pk)).first()

    def get(self, request, pk):
        issue = self._get_issue(pk)
        if not issue:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(IssueSerializer(issue).data)

    def patch(self, request, pk):
        issue = self._get_issue(pk)
        if not issue:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        # Viewers cannot edit anything
        if user.role == "viewer":
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        # Developers can only edit issues they own or are assigned to
        if user.role == "developer":
            if issue.reporter_id != user.pk and issue.assignee_id != user.pk:
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = IssueUpdateSerializer(issue, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        issue = serializer.save()
        return Response(IssueSerializer(issue).data)

    def delete(self, request, pk):
        issue = self._get_issue(pk)
        if not issue:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        issue.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LabelListView(APIView):
    """
    GET  /projects/:projectId/labels
    POST /projects/:projectId/labels (admin, pm, developer)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        labels = Label.objects.filter(project=project)
        return Response(LabelSerializer(labels, many=True).data)

    def post(self, request, project_id):
        if not request.user.can_create_issues:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        data = {**request.data, "project": project.pk}
        serializer = LabelSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        label = serializer.save()
        return Response(LabelSerializer(label).data, status=status.HTTP_201_CREATED)
