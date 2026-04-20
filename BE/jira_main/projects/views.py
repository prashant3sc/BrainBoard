from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from issues.models import Issue
from issues.serializers import IssueSerializer
from issues.views import annotate_issues
from projects.filters import ProjectFilter, SprintFilter
from projects.models import Project, ProjectMember, Sprint
from projects.serializers import (
    ProjectCreateSerializer,
    ProjectMemberSerializer,
    ProjectSerializer,
    ProjectUpdateSerializer,
    SprintSerializer,
)
from users.permissions import IsAdminOrPM


class ProjectListView(APIView):
    """
    GET /projects — list projects the requesting user is associated with (admin sees all).

    Filters:
      ?is_archived=true|false
      ?search=name_or_description
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Default to active projects; FE passes ?is_archived=true for the archive screen
        show_archived = request.query_params.get("is_archived", "false").lower() == "true"

        if request.user.is_org_admin:
            queryset = Project.objects.filter(is_archived=show_archived)
        else:
            member_project_ids = ProjectMember.objects.filter(
                user=request.user
            ).values_list("project_id", flat=True)
            queryset = Project.objects.filter(is_archived=show_archived).filter(
                Q(owner=request.user) | Q(id__in=member_project_ids)
            )
        filterset = ProjectFilter(request.query_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs
        return Response(ProjectSerializer(queryset, many=True).data)


class ProjectCreateView(APIView):
    """POST /projects/create — create a new project (admin, pm only)."""

    permission_classes = [IsAdminOrPM]

    def post(self, request):
        serializer = ProjectCreateSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        project = serializer.save()
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


class ProjectDetailView(APIView):
    """
    GET    /projects/:id — retrieve project details (any authenticated user)
    PATCH  /projects/:id — update name/description/archive (admin, pm only)
    DELETE /projects/:id — delete project (admin, pm only)
    """

    permission_classes = [IsAuthenticated]

    def _get_project(self, pk):
        try:
            return Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return None

    def get(self, request, pk):
        project = self._get_project(pk)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(ProjectSerializer(project).data)

    def patch(self, request, pk):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        project = self._get_project(pk)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        # PM can only archive/update projects they own; admin has no restriction
        if not request.user.is_org_admin and project.owner != request.user:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = ProjectUpdateSerializer(project, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        project = serializer.save()
        return Response(ProjectSerializer(project).data)

    def delete(self, request, pk):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        project = self._get_project(pk)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProjectMemberListView(APIView):
    """GET /projects/:id/members — list all members of a project."""

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        members = ProjectMember.objects.filter(project=project).select_related("user")
        return Response(ProjectMemberSerializer(members, many=True).data)


class ProjectMemberAddView(APIView):
    """POST /projects/:id/members — add a user to a project (admin, pm only)."""

    permission_classes = [IsAdminOrPM]

    def post(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ProjectMemberSerializer(data=request.data, context={"project": project})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        member = serializer.save()
        return Response(ProjectMemberSerializer(member).data, status=status.HTTP_201_CREATED)


class ProjectMemberDeleteView(APIView):
    """DELETE /projects/:id/members/:user_id — remove a user from a project (admin, pm only)."""

    permission_classes = [IsAdminOrPM]

    def delete(self, request, project_id, user_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            member = ProjectMember.objects.get(project=project, user_id=user_id)
        except ProjectMember.DoesNotExist:
            return Response({"detail": "Member not found"}, status=status.HTTP_404_NOT_FOUND)
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActiveSprintView(APIView):
    """GET /projects/:id/active-sprint — returns active sprint + its tickets, or 404 if none."""

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            sprint = Sprint.objects.get(project=project, status=Sprint.ACTIVE)
        except Sprint.DoesNotExist:
            return Response({"detail": "No active sprint"}, status=status.HTTP_404_NOT_FOUND)

        issues = annotate_issues(Issue.objects.filter(sprint=sprint).select_related("assignee", "reporter"))
        return Response({
            "sprint": SprintSerializer(sprint).data,
            "issues": IssueSerializer(issues, many=True).data,
        })


class SprintListView(APIView):
    """
    GET  /projects/:id/sprints — list all sprints (planned, active, completed) for right panel
    POST /projects/:id/sprints — create a sprint in planned state (admin, pm only)
    """

    permission_classes = [IsAuthenticated]

    def _get_project(self, pk):
        try:
            return Project.objects.get(pk=pk)
        except Project.DoesNotExist:
            return None

    def get(self, request, project_id):
        project = self._get_project(project_id)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        queryset = Sprint.objects.filter(project=project)
        filterset = SprintFilter(request.query_params, queryset=queryset)
        if filterset.is_valid():
            queryset = filterset.qs
        return Response(SprintSerializer(queryset, many=True).data)

    def post(self, request, project_id):
        if not request.user.can_plan_sprints:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        project = self._get_project(project_id)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        data = {**request.data, "project": str(project.pk)}
        serializer = SprintSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        sprint = serializer.save()
        return Response(SprintSerializer(sprint).data, status=status.HTTP_201_CREATED)


class SprintDetailView(APIView):
    """PATCH /sprints/:id — start (planned→active) or end (active→completed) a sprint."""

    permission_classes = [IsAdminOrPM]

    def _get_sprint(self, pk):
        try:
            return Sprint.objects.get(pk=pk)
        except Sprint.DoesNotExist:
            return None

    def patch(self, request, pk):
        sprint = self._get_sprint(pk)
        if not sprint:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        new_status = request.data.get("status")

        # Enforce: only one active sprint per project at a time
        if new_status == Sprint.ACTIVE:
            if Sprint.objects.filter(project=sprint.project, status=Sprint.ACTIVE).exists():
                return Response(
                    {"detail": "A sprint is already active for this project. End it before starting a new one."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # On sprint completion: move unfinished tickets to backlog or a chosen planned sprint
        if new_status == Sprint.COMPLETED and sprint.status == Sprint.ACTIVE:
            unfinished_qs = Issue.objects.filter(sprint=sprint).exclude(status=Issue.DONE)
            action = request.data.get("unfinishedAction", "backlog")

            if action == "next_sprint":
                next_sprint_id = request.data.get("nextSprintId")

                if not next_sprint_id:
                    return Response(
                        {"detail": "nextSprintId is required when unfinishedAction is next_sprint"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                try:
                    next_sprint = Sprint.objects.get(
                        pk=next_sprint_id,
                        project=sprint.project,
                        status=Sprint.PLANNED,
                    )
                except Sprint.DoesNotExist:
                    return Response(
                        {"detail": "Target sprint not found, does not belong to this project, or is not in planned status"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                unfinished_qs.update(sprint=next_sprint)
                next_sprint.status = Sprint.ACTIVE
                next_sprint.save()
            else:
                unfinished_qs.update(sprint=None)

        serializer = SprintSerializer(sprint, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        sprint = serializer.save()
        return Response(SprintSerializer(sprint).data)
