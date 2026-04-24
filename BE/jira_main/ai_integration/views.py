import requests
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from issues.models import Issue
from projects.models import Project, ProjectMember, Sprint
from wiki.models import WikiPage

User = get_user_model()

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


def _build_user_payload(user, project_names: list[str]) -> dict:
    return {
        "user_id": str(user.id),
        "name": user.get_full_name().strip() or user.email,
        "email": user.email,
        "role": user.role,
        "projects": project_names,
    }


def _build_project_payload(project: Project) -> dict:
    members = (
        ProjectMember.objects
        .filter(project=project)
        .select_related("user")
    )
    member_names = [
        pm.user.get_full_name().strip() or pm.user.email
        for pm in members
    ]
    owner_name = (project.owner.get_full_name().strip() or project.owner.email) if project.owner else "Unknown"
    return {
        "project_id": str(project.id),
        "name": project.name,
        "description": project.description or "",
        "owner": owner_name,
        "members": member_names,
        "is_archived": project.is_archived,
    }


def _build_sprint_payload(sprint: Sprint) -> dict:
    issues = Issue.objects.filter(sprint=sprint)
    done_count = issues.filter(status=Issue.DONE).count()
    return {
        "sprint_id": str(sprint.id),
        "name": sprint.name,
        "project": sprint.project.name,
        "status": sprint.status,
        "start_date": str(sprint.start_date) if sprint.start_date else None,
        "end_date": str(sprint.end_date) if sprint.end_date else None,
        "total_issues": issues.count(),
        "done_issues": done_count,
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
                scoped_project = Project.objects.get(pk=project_id)
            except Project.DoesNotExist:
                return Response({"detail": "Project not found."}, status=status.HTTP_404_NOT_FOUND)

            issues_qs = (
                Issue.objects
                .filter(project=scoped_project)
                .select_related("project", "assignee")
                .prefetch_related("labels")
            )
            wiki_qs = (
                WikiPage.objects
                .filter(project=scoped_project)
                .select_related("project", "space", "parent", "created_by")
            )
            projects_qs = Project.objects.filter(pk=scoped_project.pk).select_related("owner")
            sprints_qs = Sprint.objects.filter(project=scoped_project).select_related("project")
            # Users scoped to this project's members
            member_ids = ProjectMember.objects.filter(project=scoped_project).values_list("user_id", flat=True)
            users_qs = User.objects.filter(id__in=member_ids)
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
            projects_qs = Project.objects.select_related("owner").all()
            sprints_qs = Sprint.objects.select_related("project").all()
            users_qs = User.objects.all()

        # Build user payloads with their project names
        user_project_map: dict[str, list[str]] = {}
        for pm in ProjectMember.objects.select_related("user", "project").filter(user__in=users_qs):
            uid = str(pm.user_id)
            user_project_map.setdefault(uid, []).append(pm.project.name)

        issues_payload   = [_build_issue_payload(i) for i in issues_qs]
        wiki_payload     = [_build_wiki_payload(p) for p in wiki_qs]
        projects_payload = [_build_project_payload(p) for p in projects_qs]
        sprints_payload  = [_build_sprint_payload(s) for s in sprints_qs]
        users_payload    = [
            _build_user_payload(u, user_project_map.get(str(u.id), []))
            for u in users_qs
        ]

        try:
            result = ai_client.full_sync(
                issues_payload,
                wiki_payload,
                users=users_payload,
                projects=projects_payload,
                sprints=sprints_payload,
            )
        except requests.RequestException as exc:
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({
            "postgres": {
                "issues":   len(issues_payload),
                "wiki_pages": len(wiki_payload),
                "users":    len(users_payload),
                "projects": len(projects_payload),
                "sprints":  len(sprints_payload),
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
            "issues":    Issue.objects.count(),
            "wiki_pages": WikiPage.objects.count(),
            "users":     User.objects.count(),
            "projects":  Project.objects.count(),
            "sprints":   Sprint.objects.count(),
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


class AnalyzeDraftView(APIView):
    """
    POST /ai/analyze-draft

    Analyzes an unsaved (draft) issue using title, description and labels
    supplied directly in the request body — no issue_id required.

    Body: { "title", "description", "labels": [], "project_id" }
    Returns the same shape as AnalyzeIssueView so the FE can reuse AIAnalysisPanel.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        title       = request.data.get("title", "").strip()
        description = request.data.get("description", "").strip()
        labels      = request.data.get("labels", [])
        project_id  = request.data.get("project_id", "").strip()

        if not title:
            return Response({"detail": "title is required."}, status=status.HTTP_400_BAD_REQUEST)

        description = description or f"Issue titled: {title}"

        try:
            analysis = ai_client.analyze_task(
                heading=title,
                description=description,
                labels=labels,
            )
        except requests.RequestException as exc:
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Match recommended name against project members if project_id provided
        matched_user = None
        recommended_name = (analysis.get("recommended_team") or {}).get("Assigned To", "")

        if recommended_name and recommended_name != "Unassigned" and project_id:
            try:
                project = Project.objects.get(pk=project_id)
                project_members = (
                    ProjectMember.objects
                    .filter(project=project)
                    .select_related("user")
                )
                recommended_lower = recommended_name.lower()
                for pm in project_members:
                    full_name = pm.user.get_full_name().strip().lower()
                    if recommended_lower == full_name or recommended_lower in full_name or full_name in recommended_lower:
                        matched_user = {
                            "id": str(pm.user.id),
                            "name": pm.user.get_full_name().strip() or pm.user.email,
                            "email": pm.user.email,
                            "role": pm.user.role,
                        }
                        break
                    if recommended_lower.split()[0] == full_name.split()[0]:
                        matched_user = {
                            "id": str(pm.user.id),
                            "name": pm.user.get_full_name().strip() or pm.user.email,
                            "email": pm.user.email,
                            "role": pm.user.role,
                        }
            except Project.DoesNotExist:
                pass

        return Response({
            "issue_id": None,
            "issue_title": title,
            "labels": labels,
            "analysis": analysis,
            "recommended_user": matched_user,
        })


class ChatView(APIView):
    """
    POST /ai/chat

    Body: { "message": "<user query>", "project_id": "<uuid>" (optional) }
    RAG-powered read-only assistant scoped to BrainBoard data.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        message = request.data.get("message", "").strip()
        if not message:
            return Response({"detail": "message is required."}, status=status.HTTP_400_BAD_REQUEST)

        project_id = request.data.get("project_id", "").strip()
        project_name = None
        if project_id:
            try:
                project = Project.objects.get(pk=project_id)
                project_name = project.name
            except Project.DoesNotExist:
                pass

        try:
            result = ai_client.chat(message, project_name=project_name)
        except requests.RequestException as exc:
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response(result)


class SprintPulseView(APIView):
    """
    GET /projects/<project_id>/ai-pulse

    Returns real sprint stats (done/in_progress/todo counts, story points, team workload)
    computed from Postgres, plus AI-generated summary and highlights.
    Returns 404 if the project has no active sprint.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            sprint = Sprint.objects.get(project_id=project_id, status=Sprint.ACTIVE)
        except Sprint.DoesNotExist:
            return Response({"detail": "No active sprint."}, status=status.HTTP_404_NOT_FOUND)

        issues = (
            Issue.objects
            .filter(sprint=sprint)
            .select_related("assignee")
            .prefetch_related("labels")
        )

        # ── Compute counts ────────────────────────────────────────────────────
        done_issues = [i for i in issues if i.status == Issue.DONE]
        ip_issues   = [i for i in issues if i.status == Issue.IN_PROGRESS]
        rv_issues   = [i for i in issues if i.status == Issue.REVIEW]
        todo_issues = [i for i in issues if i.status == Issue.TODO]

        points_burned = sum(i.story_points or 0 for i in done_issues)
        points_total  = sum(i.story_points or 0 for i in issues)

        # ── Team workload ─────────────────────────────────────────────────────
        team_map: dict[str, dict] = {}
        for issue in issues:
            if not issue.assignee:
                continue
            uid = str(issue.assignee_id)
            if uid not in team_map:
                name = issue.assignee.get_full_name().strip() or issue.assignee.email
                team_map[uid] = {
                    "name":       name,
                    "role":       issue.assignee.role,
                    "task_count": 0,
                }
            team_map[uid]["task_count"] += 1

        # ── Build AI payload ──────────────────────────────────────────────────
        sprint_info = {
            "name":       sprint.name,
            "start_date": str(sprint.start_date) if sprint.start_date else "",
            "end_date":   str(sprint.end_date)   if sprint.end_date   else "",
        }
        issues_payload = [
            {
                "title":        i.title,
                "status":       i.status,
                "priority":     i.priority,
                "labels":       list(i.labels.values_list("name", flat=True)),
                "assignee":     (i.assignee.get_full_name().strip() or i.assignee.email) if i.assignee else "Unassigned",
                "story_points": float(i.story_points) if i.story_points else None,
            }
            for i in issues
        ]

        try:
            ai_result = ai_client.sprint_pulse(sprint_info, issues_payload)
        except requests.RequestException as exc:
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({
            "sprint": {
                "name":          sprint.name,
                "start":         str(sprint.start_date) if sprint.start_date else None,
                "end":           str(sprint.end_date)   if sprint.end_date   else None,
                "done":          len(done_issues),
                "in_progress":   len(ip_issues),
                "review":        len(rv_issues),
                "todo":          len(todo_issues),
                "points_burned": points_burned,
                "points_total":  points_total,
            },
            "summary":    ai_result.get("summary", ""),
            "highlights": ai_result.get("highlights", []),
            "team":       list(team_map.values()),
        })


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
