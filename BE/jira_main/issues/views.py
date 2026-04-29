from django.db.models import Count, Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from issues.filters import IssueFilter
from issues.models import Comment, Issue, Label
from issues.serializers import (
    CommentCreateSerializer,
    CommentEditSerializer,
    CommentSerializer,
    IssueCreateSerializer,
    IssueSerializer,
    IssueUpdateSerializer,
    LabelSerializer,
)
from projects.models import Project, ProjectMember


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
    GET    /issues/:id          (uuid or BB-12)
    PATCH  /issues/:id
    DELETE /issues/:id
    """

    permission_classes = [IsAuthenticated]

    def _get_issue(self, pk=None, ticket_id=None):
        if ticket_id:
            # Parse KEY-NUMBER format e.g. "BB-12"
            import re
            match = re.match(r'^([A-Z0-9]{1,6})-(\d+)$', ticket_id.upper())
            if not match:
                return None
            key, seq = match.group(1), int(match.group(2))
            return annotate_issues(
                Issue.objects.filter(project__key=key, sequence_number=seq)
            ).first()
        return annotate_issues(Issue.objects.filter(pk=pk)).first()

    def get(self, request, pk=None, ticket_id=None):
        issue = self._get_issue(pk=pk, ticket_id=ticket_id)
        if not issue:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(IssueSerializer(issue).data)

    def patch(self, request, pk=None, ticket_id=None):
        issue = self._get_issue(pk=pk, ticket_id=ticket_id)
        if not issue:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if request.user.role == "viewer":
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = IssueUpdateSerializer(issue, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        issue = serializer.save()
        return Response(IssueSerializer(issue).data)

    def delete(self, request, pk=None, ticket_id=None):
        issue = self._get_issue(pk=pk, ticket_id=ticket_id)
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


class LabelDetailView(APIView):
    """DELETE /projects/:projectId/labels/:label_id (admin, pm only)"""

    permission_classes = [IsAuthenticated]

    def delete(self, request, project_id, label_id):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        try:
            label = Label.objects.get(pk=label_id, project_id=project_id)
        except Label.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        label.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Comments
# ─────────────────────────────────────────────────────────────────────────────

def _is_project_member(user, issue):
    """True if the user is a member of the issue's project OR is an admin/pm."""
    if user.can_manage_projects:
        return True
    return ProjectMember.objects.filter(project=issue.project, user=user).exists()


class IssueCommentListView(APIView):
    """
    GET  /issues/<pk>/comments  — list all top-level comments + nested replies (oldest first)
    POST /issues/<pk>/comments  — create a comment or a reply (parentId in body)
    """

    permission_classes = [IsAuthenticated]

    def _get_issue(self, pk):
        try:
            return Issue.objects.select_related("project").get(pk=pk)
        except Issue.DoesNotExist:
            return None

    def get(self, request, pk):
        issue = self._get_issue(pk)
        if not issue:
            return Response({"detail": "Issue not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _is_project_member(request.user, issue):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        # Only top-level comments; replies are nested via prefetch
        qs = (
            Comment.objects
            .filter(ticket=issue, parent__isnull=True)
            .select_related("author")
            .prefetch_related("replies__author")
            .order_by("created_at")
        )
        return Response(CommentSerializer(qs, many=True).data)

    def post(self, request, pk):
        issue = self._get_issue(pk)
        if not issue:
            return Response({"detail": "Issue not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _is_project_member(request.user, issue):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CommentCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        parent_id = serializer.validated_data.get("parentId")
        parent    = Comment.objects.get(pk=parent_id) if parent_id else None

        comment = Comment.objects.create(
            ticket=issue,
            author=request.user,
            body=serializer.validated_data["body"],
            parent=parent,
        )

        # Return full comment (with replies) for top-level, or just the reply for replies
        if parent is None:
            out = CommentSerializer(
                Comment.objects.prefetch_related("replies__author").select_related("author").get(pk=comment.pk)
            )
        else:
            out = CommentSerializer(
                Comment.objects.select_related("author").prefetch_related("replies__author").get(pk=parent.pk)
            )
        return Response(out.data, status=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    """
    PATCH  /comments/<pk>  — edit body (own author only)
    DELETE /comments/<pk>  — admin/PM only; blocked if top-level with others' replies
    """

    permission_classes = [IsAuthenticated]

    def _get_comment(self, pk):
        try:
            return Comment.objects.select_related("author", "ticket__project").get(pk=pk)
        except Comment.DoesNotExist:
            return None

    def patch(self, request, pk):
        comment = self._get_comment(pk)
        if not comment:
            return Response({"detail": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)
        if not _is_project_member(request.user, comment.ticket):
            return Response({"detail": "Forbidden."}, status=status.HTTP_403_FORBIDDEN)
        if comment.author_id != request.user.pk:
            return Response({"detail": "You can only edit your own comments."}, status=status.HTTP_403_FORBIDDEN)

        serializer = CommentEditSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        comment.body = serializer.validated_data["body"]
        comment.save(update_fields=["body", "updated_at"])

        # Return updated parent comment (with replies intact)
        root = comment if comment.parent_id is None else comment.parent
        out  = CommentSerializer(
            Comment.objects.select_related("author").prefetch_related("replies__author").get(pk=root.pk)
        )
        return Response(out.data)

    def delete(self, request, pk):
        comment = self._get_comment(pk)
        if not comment:
            return Response({"detail": "Comment not found."}, status=status.HTTP_404_NOT_FOUND)

        # Only admin / PM can delete
        if not request.user.can_manage_projects:
            return Response({"detail": "Only admins and project managers can delete comments."}, status=status.HTTP_403_FORBIDDEN)

        # Block if top-level comment has replies from other users
        if comment.parent_id is None and comment.has_others_replies:
            return Response(
                {"detail": "Cannot delete — this comment has replies from other users."},
                status=status.HTTP_409_CONFLICT,
            )

        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
