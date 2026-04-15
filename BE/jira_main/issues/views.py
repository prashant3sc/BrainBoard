from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from issues.models import Issue, Label
from issues.serializers import (
    IssueCreateSerializer,
    IssueSerializer,
    IssueUpdateSerializer,
    LabelSerializer,
)
from projects.models import Project


class ProjectIssueListView(APIView):
    """
    GET  /projects/:projectId/issues — list issues for a project
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        issues = Issue.objects.filter(project=project).select_related("assignee", "reporter")
        return Response(IssueSerializer(issues, many=True).data)


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
        return Response(IssueSerializer(issue).data, status=status.HTTP_201_CREATED)


class IssueDetailView(APIView):
    """
    GET    /issues/:id
    PATCH  /issues/:id — edit (admin, pm, developer; developer limited to own/assigned)
    DELETE /issues/:id — admin, pm only
    """

    permission_classes = [IsAuthenticated]

    def _get_issue(self, pk):
        try:
            return Issue.objects.get(pk=pk)
        except Issue.DoesNotExist:
            return None

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
