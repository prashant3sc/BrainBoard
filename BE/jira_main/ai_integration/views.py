import requests
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from issues.models import Issue
from projects.models import Project, ProjectMember
from wiki.models import WikiPage

from . import ai_client


def _build_issue_payload(issue: Issue) -> dict:
    label_names = list(issue.labels.values_list("name", flat=True))
    assignee_name = ""
    if issue.assignee:
        assignee_name = issue.assignee.get_full_name().strip() or issue.assignee.email
    return {
        "issue_id": str(issue.id),
        "title": issue.title,
        "description": issue.description or "",
        "labels": label_names,
        "assignee": assignee_name or "Unassigned",
        "story_points": float(issue.story_points) if issue.story_points else None,
        "project": issue.project.name,
        "issue_type": issue.issue_type,
        "priority": issue.priority,
        "status": issue.status,
    }


def _build_wiki_payload(page: WikiPage) -> dict:
    created_by = ""
    if page.created_by:
        created_by = page.created_by.get_full_name().strip() or page.created_by.email
    return {
        "wiki_id": str(page.id),
        "title": page.title,
        "content": page.content or "",
        "project": page.project.name,
        "space": page.space.name if page.space else None,
        "parent_title": page.parent.title if page.parent else None,
        "created_by": created_by or None,
    }


class SyncView(APIView):
    """
    POST /ai/sync

    Full Postgres → ChromaDB resync.

    Fetches all issues and wiki pages from every table in the BE app,
    deletes all existing ChromaDB data, and re-embeds everything fresh.

    Use this any time ChromaDB may have drifted from Postgres —
    e.g. after bulk imports, migrations, or manual DB changes.

    Optional body:
      { "project_id": "<uuid>" }  — scope sync to a single project
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        project_id = request.data.get("project_id")

        if project_id:
            try:
                project = Project.objects.get(pk=project_id)
            except Project.DoesNotExist:
                return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

            issues_qs = (
                Issue.objects
                .filter(project=project)
                .select_related("project", "assignee")
                .prefetch_related("labels")
            )
            wiki_qs = (
                WikiPage.objects
                .filter(project=project)
                .select_related("project", "space", "parent", "created_by")
            )
        else:
            issues_qs = (
                Issue.objects
                .select_related("project", "assignee")
                .prefetch_related("labels")
                .all()
            )
            wiki_qs = (
                WikiPage.objects
                .select_related("project", "space", "parent", "created_by")
                .all()
            )

        issues_payload = [_build_issue_payload(i) for i in issues_qs]
        wiki_payload = [_build_wiki_payload(p) for p in wiki_qs]

        if not issues_payload and not wiki_payload:
            return Response({"detail": "No data found to sync.", "synced": 0})

        try:
            result = ai_client.full_sync(issues_payload, wiki_payload)
        except requests.RequestException as exc:
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({
            "postgres": {
                "issues": len(issues_payload),
                "wiki_pages": len(wiki_payload),
            },
            "chroma": result,
        })


class SyncStatusView(APIView):
    """
    GET /ai/sync/status

    Returns side-by-side counts from both Postgres and ChromaDB
    so you can see at a glance whether they're in sync.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        postgres_counts = {
            "issues": Issue.objects.count(),
            "wiki_pages": WikiPage.objects.count(),
        }

        try:
            chroma_result = ai_client.sync_status()
        except requests.RequestException as exc:
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        chroma_counts = chroma_result.get("chroma", {})
        in_sync = (
            postgres_counts["issues"] == chroma_counts.get("issues", -1)
            and postgres_counts["wiki_pages"] == chroma_counts.get("wiki_pages", -1)
        )

        return Response({
            "in_sync": in_sync,
            "postgres": postgres_counts,
            "chroma": chroma_counts,
        })


class AnalyzeIssueView(APIView):
    """
    POST /ai/analyze-issue/<issue_id>

    Fetches the issue (title, description, labels) from Postgres,
    calls AI RAG to estimate story points and recommend an assignee
    based on who handled similar labeled issues in the past.

    The recommended name from AI is matched against actual project members
    so the FE gets a real user object it can apply directly.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, issue_id):
        try:
            issue = (
                Issue.objects
                .select_related("project", "assignee")
                .prefetch_related("labels")
                .get(pk=issue_id)
            )
        except Issue.DoesNotExist:
            return Response({"detail": "Issue not found."}, status=status.HTTP_404_NOT_FOUND)

        label_names = list(issue.labels.values_list("name", flat=True))
        description = issue.description or f"{issue.issue_type} issue, priority: {issue.priority}"

        try:
            analysis = ai_client.analyze_task(
                heading=issue.title,
                description=description,
                labels=label_names,
            )
        except requests.RequestException as exc:
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Match AI's recommended name to a real project member
        recommended_name = (analysis.get("recommended_team") or {}).get("Assigned To", "")
        matched_user = None

        if recommended_name and recommended_name != "Unassigned":
            project_members = (
                ProjectMember.objects
                .filter(project=issue.project)
                .select_related("user")
            )
            recommended_lower = recommended_name.lower()
            for pm in project_members:
                full_name = pm.user.get_full_name().strip().lower()
                email = pm.user.email.lower()
                if recommended_lower == full_name or recommended_lower in full_name or full_name in recommended_lower:
                    matched_user = {
                        "id": str(pm.user.id),
                        "name": pm.user.get_full_name().strip() or pm.user.email,
                        "email": pm.user.email,
                        "role": pm.user.role,
                    }
                    break
                # fallback: first-name match
                if recommended_lower.split()[0] == full_name.split()[0]:
                    matched_user = {
                        "id": str(pm.user.id),
                        "name": pm.user.get_full_name().strip() or pm.user.email,
                        "email": pm.user.email,
                        "role": pm.user.role,
                    }

        return Response({
            "issue_id": str(issue.id),
            "issue_title": issue.title,
            "labels": label_names,
            "analysis": analysis,
            "recommended_user": matched_user,  # real user object, or null if no match
        })


class ChatView(APIView):
    """
    POST /ai/chat

    Body: { "message": "<user query>" }
    Proxies to AI chatbot — answers technical questions or drafts Jira tickets.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get("message", "").strip()
        if not message:
            return Response({"detail": "message is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = ai_client.chat(message)
        except requests.RequestException as exc:
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(result)


class AIHealthView(APIView):
    """GET /ai/health — checks if the AI layer is reachable."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            result = ai_client.health_check()
            return Response({"status": "ok", "ai_layer": result})
        except requests.RequestException as exc:
            return Response(
                {"status": "unreachable", "detail": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
