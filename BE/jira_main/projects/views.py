from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project, Sprint
from projects.serializers import (
    ProjectCreateSerializer,
    ProjectSerializer,
    ProjectUpdateSerializer,
    SprintSerializer,
)


class ProjectListView(APIView):
    """
    GET  /projects — list all non-archived projects
    POST /projects — create project (admin, pm only)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        projects = Project.objects.filter(is_archived=False)
        return Response(ProjectSerializer(projects, many=True).data)

    def post(self, request):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = ProjectCreateSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        project = serializer.save()
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)


class ProjectDetailView(APIView):
    """
    GET    /projects/:id — retrieve
    PATCH  /projects/:id — update metadata (admin, pm)
    DELETE /projects/:id — delete (admin, pm)
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
        project = self._get_project(pk)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = ProjectUpdateSerializer(project, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        project = serializer.save()
        return Response(ProjectSerializer(project).data)

    def delete(self, request, pk):
        project = self._get_project(pk)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        project.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class SprintListView(APIView):
    """
    GET  /projects/:projectId/sprints
    POST /projects/:projectId/sprints (admin, pm)
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
        sprints = Sprint.objects.filter(project=project)
        return Response(SprintSerializer(sprints, many=True).data)

    def post(self, request, project_id):
        if not request.user.can_plan_sprints:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        project = self._get_project(project_id)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        data = {**request.data, "project": project.pk}
        serializer = SprintSerializer(data=data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        sprint = serializer.save()
        return Response(SprintSerializer(sprint).data, status=status.HTTP_201_CREATED)


class SprintDetailView(APIView):
    """
    PATCH /sprints/:id — update sprint (status transitions, dates)
    """

    permission_classes = [IsAuthenticated]

    def _get_sprint(self, pk):
        try:
            return Sprint.objects.get(pk=pk)
        except Sprint.DoesNotExist:
            return None

    def patch(self, request, pk):
        sprint = self._get_sprint(pk)
        if not sprint:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if not request.user.can_plan_sprints:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = SprintSerializer(sprint, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        sprint = serializer.save()
        return Response(SprintSerializer(sprint).data)
