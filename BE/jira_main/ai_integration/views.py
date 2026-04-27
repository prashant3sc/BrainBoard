import logging
import re
import requests
from concurrent.futures import ThreadPoolExecutor

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

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


def _build_sources_from_chromadb(results: list[dict], answer_text: str) -> list[dict]:
    """
    Build a deduplicated list of source references from ChromaDB result dicts.

    Prioritisation:
      1. Documents whose title appears verbatim in the answer text (most relevant).
      2. All other retrieved documents, in retrieval order.

    Cap: at most 3 sources.

    Each source has shape: {"type": str, "id": str, "title": str}
    """
    answer_lower = answer_text.lower()
    seen: set[tuple] = set()
    primary:   list[dict] = []
    secondary: list[dict] = []

    for r in results:
        doc_type = (r.get("type") or "").strip()
        doc_id   = (r.get("id")   or "").strip()
        title    = (r.get("title") or "").strip()

        if not doc_type or not doc_id:
            continue  # skip malformed entries

        key = (doc_type, doc_id)
        if key in seen:
            continue
        seen.add(key)

        source = {"type": doc_type, "id": doc_id, "title": title}
        if title and title.lower() in answer_lower:
            primary.append(source)
        else:
            secondary.append(source)

    return (primary + secondary)[:3]


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


class ChatbotQueryView(APIView):
    """
    POST /api/chatbot/query/

    Project/sprint-scoped RAG chatbot.  Full pipeline:

      1. Validate — query required, history capped at 4 turns.
      2. Resolve project_id / sprint_id → names for ChromaDB filtering.
      3. Build live page context from Postgres (get_page_context).
      4. Classify the query to decide what to fetch (classify_query).
      5. Run ChromaDB search + optional bandwidth SQL in parallel
         (ThreadPoolExecutor — Django runs under WSGI, not ASGI).
      6. Build a plain-text system prompt combining page context,
         ChromaDB results, and bandwidth data.
      7. Build the messages array: system + history + current query.
      8. Call the LLM via FastAPI /llm/generate (plain text, json_mode=False).
      9. Assemble sources from ChromaDB metadata and return
         {answer, sources}.

    Body:
      {
        "query":      string,                            required
        "project_id": uuid | null,
        "sprint_id":  uuid | null,
        "page":       "kanban"|"backlog"|"wiki"|"analytics"|"dashboard",
        "history":    [{"role": string, "content": string}]  // max 4
      }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from .page_context import get_page_context, to_prompt_text, get_team_bandwidth
        from .classifier import classify_query
        from .prompts import CHATBOT_SYSTEM_PROMPT
        from .serializers import ChatbotQuerySerializer

        # ── 1. Validate ───────────────────────────────────────────────────
        serializer = ChatbotQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        query      = data["query"].strip()
        history    = data["history"]          # already capped at 4 by validate_history
        project_id = data.get("project_id")   # UUID instance or None
        sprint_id  = data.get("sprint_id")    # UUID instance or None
        page       = data.get("page") or ""

        # ── 2. Resolve IDs → display names (used as ChromaDB filter values) ─
        project_name: str | None = None
        if project_id:
            try:
                project_obj  = Project.objects.get(pk=project_id)
                project_name = project_obj.name
            except Project.DoesNotExist:
                project_id = None  # treat as missing so filters are not wrong

        sprint_name: str | None = None
        if sprint_id:
            try:
                sprint_obj  = Sprint.objects.get(pk=sprint_id)
                sprint_name = sprint_obj.name
            except Sprint.DoesNotExist:
                sprint_id = None

        # ── 3. Live page context from Postgres ────────────────────────────
        ctx = get_page_context(
            page,
            str(project_id) if project_id else None,
            str(sprint_id)  if sprint_id  else None,
        )
        page_context_text = to_prompt_text(ctx)

        # ── 4. Classify query ─────────────────────────────────────────────
        classification   = classify_query(query, page)
        needs_chromadb   = classification["needs_chromadb"]
        doc_types        = classification["doc_types"]
        sql_queries      = classification["sql_queries"]

        logger.info(
            "ChatbotQuery classify: needs_chromadb=%s doc_types=%s sql_queries=%s "
            "project_id=%s sprint_id=%s page=%s",
            needs_chromadb, doc_types, sql_queries, project_id, sprint_id, page,
        )

        # ── 5. Parallel fetch: ChromaDB + bandwidth SQL ───────────────────
        chromadb_results: list[dict] = []
        bandwidth_text:   str        = ""

        def _fetch_chromadb() -> list[dict]:
            if not needs_chromadb:
                return []
            try:
                return ai_client.chromadb_query(
                    query=query,
                    project_id=str(project_id) if project_id else None,
                    doc_types=doc_types,
                    sprint_id=str(sprint_id) if sprint_id else None,
                )
            except requests.RequestException as exc:
                logger.warning("ChatbotQuery: ChromaDB fetch failed: %s", exc)
                return []

        def _fetch_bandwidth() -> str:
            if "bandwidth" not in sql_queries or not project_id:
                return ""
            try:
                return get_team_bandwidth(str(project_id))
            except Exception as exc:
                logger.warning("ChatbotQuery: bandwidth fetch failed: %s", exc)
                return ""

        with ThreadPoolExecutor(max_workers=2) as executor:
            future_chroma = executor.submit(_fetch_chromadb)
            future_bw     = executor.submit(_fetch_bandwidth)
            chromadb_results = future_chroma.result()
            bandwidth_text   = future_bw.result()

        logger.info(
            "ChatbotQuery parallel fetch done: %d chromadb docs, bandwidth=%s",
            len(chromadb_results), bool(bandwidth_text),
        )

        # ── 6. Build system prompt ────────────────────────────────────────
        chromadb_context = (
            "\n\n---\n\n".join(r["text"] for r in chromadb_results)
            if chromadb_results
            else "No relevant workspace data found."
        )

        bandwidth_section = (
            f"\nTEAM BANDWIDTH:\n{bandwidth_text}\n"
            if bandwidth_text
            else ""
        )

        system_content = CHATBOT_SYSTEM_PROMPT.format(
            page             = page or "unknown",
            page_context     = page_context_text or "No live page data available.",
            chromadb_context = chromadb_context,
            bandwidth_section= bandwidth_section,
        )

        # ── 7. Build messages array ───────────────────────────────────────
        messages: list[dict] = [{"role": "system", "content": system_content}]

        for h in history:
            role    = (h.get("role") or "user").lower()
            content = (h.get("content") or "").strip()
            if role in ("user", "assistant") and content:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": query})

        # ── 8. Call LLM (plain text — json_mode=False) ────────────────────
        try:
            answer_text: str = ai_client.llm_generate(messages, json_mode=False)
        except requests.RequestException as exc:
            logger.error("ChatbotQuery: LLM call failed: %s", exc)
            return Response(
                {"detail": f"AI layer unreachable: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ── 9. Build sources + return ─────────────────────────────────────
        sources = _build_sources_from_chromadb(chromadb_results, answer_text)
        return Response({"answer": answer_text, "sources": sources})


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
