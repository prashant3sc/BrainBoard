from datetime import date, timedelta

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

        # Optional multi-assignee filter: ?assignee_ids=uuid1,uuid2,...
        raw = request.query_params.get("assignee_ids", "").strip()
        if raw:
            ids = [uid.strip() for uid in raw.split(",") if uid.strip()]
            if ids:
                issues = issues.filter(assignee_id__in=ids)

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
    """
    GET   /sprints/:id — retrieve sprint details (any authenticated user)
    PATCH /sprints/:id — start (planned→active) or end (active→completed) a sprint (admin, pm only)
    """

    permission_classes = [IsAuthenticated]

    def _get_sprint(self, pk):
        try:
            return Sprint.objects.get(pk=pk)
        except Sprint.DoesNotExist:
            return None

    def get(self, request, pk):
        sprint = self._get_sprint(pk)
        if not sprint:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(SprintSerializer(sprint).data)

    def patch(self, request, pk):
        if not request.user.can_plan_sprints:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
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


class VelocityView(APIView):
    """
    GET /projects/<project_id>/analytics/velocity

    Returns per-sprint velocity data for the project:
    - committed: total story points planned at sprint start
    - completed: story points of done issues
    - completion_rate: % of committed points completed
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        sprints = (
            Sprint.objects
            .filter(project=project, status__in=[Sprint.COMPLETED, Sprint.ACTIVE])
            .order_by("start_date", "created_at")
        )

        data = []
        for sprint in sprints:
            issues = Issue.objects.filter(sprint=sprint)
            committed = sum(i.story_points or 0 for i in issues)
            completed = sum(i.story_points or 0 for i in issues if i.status == Issue.DONE)
            rate = round((completed / committed * 100), 1) if committed > 0 else 0
            data.append({
                "sprint_id":       str(sprint.id),
                "sprint_name":     sprint.name,
                "status":          sprint.status,
                "start_date":      str(sprint.start_date) if sprint.start_date else None,
                "end_date":        str(sprint.end_date)   if sprint.end_date   else None,
                "committed":       round(float(committed), 1),
                "completed":       round(float(completed), 1),
                "completion_rate": rate,
            })

        avg_velocity = (
            round(sum(d["completed"] for d in data) / len(data), 1)
            if data else 0
        )

        return Response({
            "project_id":   str(project.id),
            "project_name": project.name,
            "sprints":      data,
            "avg_velocity": avg_velocity,
        })


class WorkloadView(APIView):
    """
    GET /projects/<project_id>/analytics/workload

    Returns per-member workload for all active/open issues in the project:
    - issue counts by status (todo, in_progress, review, done)
    - total story points assigned
    - issue count by priority
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        members = ProjectMember.objects.filter(project=project).select_related("user")
        issues  = Issue.objects.filter(project=project).select_related("assignee")

        member_map = {}
        for m in members:
            u = m.user
            member_map[str(u.id)] = {
                "user_id":   str(u.id),
                "name":      u.get_full_name() or u.username or u.email,
                "email":     u.email,
                "role":      u.role,
                "todo":      0,
                "in_progress": 0,
                "review":    0,
                "done":      0,
                "total":     0,
                "story_points": 0,
                "critical":  0,
                "high":      0,
                "medium":    0,
                "low":       0,
            }

        unassigned = {
            "user_id":   None,
            "name":      "Unassigned",
            "email":     "",
            "role":      "",
            "todo":      0,
            "in_progress": 0,
            "review":    0,
            "done":      0,
            "total":     0,
            "story_points": 0,
            "critical":  0,
            "high":      0,
            "medium":    0,
            "low":       0,
        }

        for issue in issues:
            if issue.assignee and str(issue.assignee.id) in member_map:
                bucket = member_map[str(issue.assignee.id)]
            else:
                bucket = unassigned

            bucket[issue.status] = bucket.get(issue.status, 0) + 1
            bucket["total"] += 1
            bucket["story_points"] += issue.story_points or 0
            bucket[issue.priority] = bucket.get(issue.priority, 0) + 1

        members_data = list(member_map.values())
        if unassigned["total"] > 0:
            members_data.append(unassigned)

        members_data.sort(key=lambda x: x["total"], reverse=True)

        total_issues = sum(m["total"] for m in members_data)

        return Response({
            "project_id":   str(project.id),
            "project_name": project.name,
            "total_issues": total_issues,
            "members":      members_data,
        })


class BurndownView(APIView):
    """
    GET /projects/<project_id>/analytics/burndown?sprint_id=<id>

    Returns daily burndown/burnup data for a sprint.
    Uses issue updated_at as a proxy for completion date (no per-status history tracked).
    Defaults to the active sprint when sprint_id is omitted.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

        sprint_id = request.query_params.get("sprint_id")
        if sprint_id:
            try:
                sprint = Sprint.objects.get(pk=sprint_id, project=project)
            except Sprint.DoesNotExist:
                return Response({"detail": "Sprint not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            try:
                sprint = Sprint.objects.get(project=project, status=Sprint.ACTIVE)
            except Sprint.DoesNotExist:
                sprint = Sprint.objects.filter(project=project).order_by("-created_at").first()
                if not sprint:
                    return Response({"detail": "No sprints found."}, status=status.HTTP_404_NOT_FOUND)

        issues = list(Issue.objects.filter(sprint=sprint))
        total_points = sum(i.story_points or 0 for i in issues)
        completed_points = sum(i.story_points or 0 for i in issues if i.status == Issue.DONE)

        # All completed sprints for the project (for the sprint selector on the FE)
        all_sprints = list(
            Sprint.objects
            .filter(project=project)
            .exclude(status=Sprint.PLANNED)
            .order_by("start_date", "created_at")
            .values("id", "name", "status", "start_date", "end_date")
        )
        sprints_meta = [
            {
                "sprint_id": str(s["id"]),
                "sprint_name": s["name"],
                "status": s["status"],
                "start_date": str(s["start_date"]) if s["start_date"] else None,
                "end_date": str(s["end_date"]) if s["end_date"] else None,
            }
            for s in all_sprints
        ]

        if not sprint.start_date or not sprint.end_date:
            return Response({
                "sprint_id": str(sprint.id),
                "sprint_name": sprint.name,
                "status": sprint.status,
                "start_date": None,
                "end_date": None,
                "total_points": total_points,
                "completed_points": completed_points,
                "days": [],
                "all_sprints": sprints_meta,
            })

        today = date.today()
        start = sprint.start_date
        end = sprint.end_date
        chart_end = min(end, today) if sprint.status == Sprint.ACTIVE else end
        total_days = max((end - start).days, 1)

        done_issues = [i for i in issues if i.status == Issue.DONE]

        days = []
        current = start
        while current <= chart_end:
            completed_by_day = sum(
                i.story_points or 0
                for i in done_issues
                if i.updated_at.date() <= current
            )
            day_index = (current - start).days
            ideal_remaining = round(total_points * (1 - day_index / total_days), 1)
            days.append({
                "date": str(current),
                "ideal_remaining": max(ideal_remaining, 0),
                "actual_remaining": max(total_points - completed_by_day, 0),
                "completed": min(completed_by_day, total_points),
            })
            current += timedelta(days=1)

        return Response({
            "sprint_id": str(sprint.id),
            "sprint_name": sprint.name,
            "status": sprint.status,
            "start_date": str(sprint.start_date),
            "end_date": str(sprint.end_date),
            "total_points": total_points,
            "completed_points": completed_points,
            "days": days,
            "all_sprints": sprints_meta,
        })
