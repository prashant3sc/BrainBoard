"""
Page-context builder for the BrainBoard AI chatbot.

get_page_context(page, project_id, sprint_id) → dict
    Pulls live data from Postgres that is specific to the UI page the user
    is currently viewing.  The result is a structured dict whose every field
    is a plain Python primitive (no ORM objects) so it can be safely logged,
    cached, or serialised.

to_prompt_text(ctx: dict) → str
    Renders the structured dict as a concise plain-text block that is
    injected into the LLM prompt as "LIVE PAGE DATA" — factual, grounded
    numbers the LLM can cite without hallucinating.

get_team_bandwidth(project_id) → str
    Runs a single raw SQL query joining project_members → users → issues
    and returns a plain-text capacity summary (one line per member).

Blocked definition (consistent with tasks.py):
    CRITICAL priority + status != DONE

Schema notes (spec SQL vs real schema divergences fixed here):
  - users has no project_id column → join through project_members
  - table is `issues` not `tickets`
  - no `cancelled` status → open = status != 'done'
  - no `name` column on users → COALESCE(first_name || ' ' || last_name, email)
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

import logging

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def get_page_context(
    page: str,
    project_id: str | None,
    sprint_id: str | None,
) -> dict[str, Any]:
    """
    Return live, page-specific data for the given UI page.

    Args:
        page:       One of "kanban" | "backlog" | "wiki" | "analytics" | "dashboard"
        project_id: UUID string of the current project (may be None on dashboard)
        sprint_id:  UUID string of the current sprint (may be None)

    Returns:
        A dict with a "page" key and page-specific keys described below.
        Always safe to pass to to_prompt_text().
    """
    page = (page or "").lower().strip()

    dispatch = {
        "kanban":    _kanban_context,
        "backlog":   _backlog_context,
        "wiki":      _wiki_context,
        "analytics": _analytics_context,
        "dashboard": _dashboard_context,
    }

    handler = dispatch.get(page)
    if handler is None:
        return {"page": page}

    try:
        return handler(project_id, sprint_id)
    except Exception:
        logger.exception(f"get_page_context failed for page={page!r}")
        return {"page": page, "error": "context_unavailable"}


def to_prompt_text(ctx: dict[str, Any]) -> str:
    """
    Convert a page-context dict into a concise plain-text block.

    Returns an empty string for the wiki page (nothing extra to inject)
    or when context is unavailable / unknown.
    """
    page = ctx.get("page", "")

    if ctx.get("error") or not page:
        return ""

    renderer = {
        "kanban":    _render_kanban,
        "backlog":   _render_backlog,
        "wiki":      _render_wiki,
        "analytics": _render_analytics,
        "dashboard": _render_dashboard,
    }.get(page)

    if renderer is None:
        return ""
    return renderer(ctx)


# ---------------------------------------------------------------------------
# Team bandwidth
# ---------------------------------------------------------------------------

def get_team_bandwidth(project_id: str) -> str:
    """
    Return a plain-text capacity summary for every member of the given project.

    Runs a single raw SQL query — one round-trip regardless of team size.

    Format (one line per person, sorted by load — heaviest first):
        "{name} — {open_tickets} open tickets, {high_priority_count} high priority"

    Returns "No team members found for this project." when the project has no
    members or the project_id doesn't match any row.

    Spec SQL corrections applied
    ────────────────────────────
    1. `WHERE u.project_id = …`
         Users have no project_id column.  Membership lives in `project_members`.
         Fixed: INNER JOIN project_members pm ON pm.user_id = u.id AND pm.project_id = %s

    2. `LEFT JOIN tickets t`
         The table is `issues` (db_table = "issues" in Issue model).
         Fixed: LEFT JOIN issues t ON t.assignee_id = u.id AND t.project_id = %s

    3. `NOT IN ('done', 'cancelled')`
         Issue status choices are todo / in_progress / review / done — no 'cancelled'.
         Fixed: t.status != 'done'

    4. `u.name`
         AbstractUser has first_name + last_name, not a single `name` column.
         Fixed: NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), '')
                with u.email as fallback when both name fields are blank.
    """
    from django.db import connection

    if not project_id:
        return "No project specified."

    sql = """
        SELECT
            u.id,
            NULLIF(
                TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')),
                ''
            )                                             AS full_name,
            u.email,
            COUNT(t.id) FILTER (
                WHERE t.status != 'done'
            )                                             AS open_tickets,
            COUNT(t.id) FILTER (
                WHERE t.priority IN ('high', 'critical')
                  AND t.status != 'done'
            )                                             AS high_priority_count
        FROM users u
        INNER JOIN project_members pm
               ON pm.user_id    = u.id
              AND pm.project_id = %s
        LEFT  JOIN issues t
               ON t.assignee_id = u.id
              AND t.project_id  = %s
        GROUP BY u.id, u.first_name, u.last_name, u.email
        ORDER BY high_priority_count DESC, open_tickets DESC
    """

    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, [project_id, project_id])
            rows = cursor.fetchall()
    except Exception:
        logger.exception(f"get_team_bandwidth: query failed for project_id={project_id}")
        return "Bandwidth data unavailable."

    if not rows:
        return "No team members found for this project."

    lines = []
    for _uid, full_name, email, open_tickets, high_priority_count in rows:
        name = full_name or email or "Unknown"
        lines.append(
            f"{name} — {open_tickets} open tickets, {high_priority_count} high priority"
        )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Per-page builders
# ---------------------------------------------------------------------------

def _kanban_context(project_id: str | None, sprint_id: str | None) -> dict:
    from issues.models import Issue
    from projects.models import Sprint

    # Resolve the active sprint
    active_sprint_name: str | None = None
    sprint_filter: dict = {}

    if sprint_id:
        try:
            sprint = Sprint.objects.get(pk=sprint_id)
            active_sprint_name = sprint.name
            sprint_filter = {"sprint_id": sprint_id}
        except Sprint.DoesNotExist:
            pass
    elif project_id:
        try:
            sprint = Sprint.objects.get(project_id=project_id, status=Sprint.ACTIVE)
            active_sprint_name = sprint.name
            sprint_filter = {"sprint_id": str(sprint.id)}
        except Sprint.DoesNotExist:
            pass

    # Base queryset scoped to sprint (preferred) or project
    if sprint_filter:
        base_qs = Issue.objects.filter(**sprint_filter)
    elif project_id:
        base_qs = Issue.objects.filter(project_id=project_id)
    else:
        base_qs = Issue.objects.none()

    in_progress_count = base_qs.filter(status=Issue.IN_PROGRESS).count()

    # Blocked = CRITICAL priority, not DONE (cap at 10 for prompt length)
    blocked_qs = (
        base_qs
        .filter(priority=Issue.CRITICAL)
        .exclude(status=Issue.DONE)
        .select_related("assignee")
        .only("id", "title", "priority", "status", "assignee_id",
              "assignee__first_name", "assignee__last_name", "assignee__email")
        [:10]
    )
    blocked_tickets = [
        {
            "id": str(t.id),
            "title": t.title,
            "status": t.status,
            "assignee": (
                t.assignee.get_full_name().strip() or t.assignee.email
                if t.assignee else "Unassigned"
            ),
        }
        for t in blocked_qs
    ]

    # Team bandwidth — one SQL round-trip via get_team_bandwidth
    bandwidth_text = get_team_bandwidth(project_id) if project_id else ""

    return {
        "page": "kanban",
        "active_sprint_name": active_sprint_name,
        "in_progress_count": in_progress_count,
        "blocked_tickets": blocked_tickets,
        "team_bandwidth": bandwidth_text,
    }


def _backlog_context(project_id: str | None, sprint_id: str | None) -> dict:
    from issues.models import Issue
    from projects.models import Sprint

    base_qs = Issue.objects.filter(project_id=project_id) if project_id else Issue.objects.none()

    # Unassigned = no assignee AND not yet done (backlog items that need triage)
    unassigned_count = base_qs.filter(assignee__isnull=True).exclude(status=Issue.DONE).count()

    # Next sprint = earliest PLANNED sprint for the project
    next_sprint: dict | None = None
    if project_id:
        ns = (
            Sprint.objects
            .filter(project_id=project_id, status=Sprint.PLANNED)
            .order_by("start_date", "created_at")
            .values("id", "name", "start_date", "end_date")
            .first()
        )
        if ns:
            next_sprint = {
                "id": str(ns["id"]),
                "name": ns["name"],
                "start_date": str(ns["start_date"]) if ns["start_date"] else None,
                "end_date": str(ns["end_date"]) if ns["end_date"] else None,
            }

    return {
        "page": "backlog",
        "unassigned_count": unassigned_count,
        "next_sprint": next_sprint,
    }


def _wiki_context(project_id: str | None, sprint_id: str | None) -> dict:
    # Wiki content is retrieved from ChromaDB by the RAG pipeline.
    # Nothing extra is needed from Postgres.
    return {"page": "wiki"}


def _analytics_context(project_id: str | None, sprint_id: str | None) -> dict:
    """
    Compute the last 4 weekly snapshots from Issue data.

    Each snapshot covers Mon–Sun of that week:
        - created:         issues created in that window
        - closed:          issues moved to DONE (updated_at falls in the window)
        - avg_cycle_days:  mean(updated_at − created_at) for closed issues
        - velocity:        sum of story_points for closed issues
    """
    from issues.models import Issue
    from django.utils.timezone import make_aware

    snapshots: list[dict] = []

    today = date.today()
    # Start from the Monday of the current week and walk back 4 weeks
    current_monday = today - timedelta(days=today.weekday())

    base_qs = Issue.objects.filter(project_id=project_id) if project_id else Issue.objects.all()

    for week_offset in range(4):
        week_start = current_monday - timedelta(weeks=week_offset)
        week_end = week_start + timedelta(days=6)

        try:
            ws_dt = make_aware(datetime.combine(week_start, datetime.min.time()))
            we_dt = make_aware(datetime.combine(week_end, datetime.max.time()))
        except Exception:
            ws_dt = datetime.combine(week_start, datetime.min.time())
            we_dt = datetime.combine(week_end, datetime.max.time())

        created = base_qs.filter(created_at__range=(ws_dt, we_dt)).count()

        closed_qs = base_qs.filter(
            status=Issue.DONE,
            updated_at__range=(ws_dt, we_dt),
        ).only("created_at", "updated_at", "story_points")

        closed = closed_qs.count()

        cycle_times = [
            (i.updated_at - i.created_at).days
            for i in closed_qs
            if i.updated_at >= i.created_at
        ]
        avg_cycle = round(sum(cycle_times) / len(cycle_times), 1) if cycle_times else 0
        velocity = sum(i.story_points or 0 for i in closed_qs)

        snapshots.append({
            "week_start": week_start.isoformat(),
            "created": created,
            "closed": closed,
            "avg_cycle_days": avg_cycle,
            "velocity": velocity,
        })

    return {
        "page": "analytics",
        "snapshots": snapshots,   # ordered newest-first (offset 0 = current week)
    }


def _dashboard_context(project_id: str | None, sprint_id: str | None) -> dict:
    """
    Org-wide view: ticket totals and blocked counts per active project.

    If project_id is supplied, include all projects the requesting user can
    see — we still return org-wide data because the dashboard shows all projects.
    """
    from issues.models import Issue
    from projects.models import Project
    from django.db.models import Count, Q

    active_projects = (
        Project.objects
        .filter(is_archived=False)
        .annotate(
            total_tickets=Count("project_issues"),
            in_progress_count=Count(
                "project_issues",
                filter=Q(project_issues__status=Issue.IN_PROGRESS),
            ),
            blocked_count=Count(
                "project_issues",
                filter=Q(
                    project_issues__priority=Issue.CRITICAL,
                ) & ~Q(project_issues__status=Issue.DONE),
            ),
        )
        .values("id", "name", "total_tickets", "in_progress_count", "blocked_count")
        .order_by("name")
    )

    projects = [
        {
            "id": str(p["id"]),
            "name": p["name"],
            "total_tickets": p["total_tickets"],
            "in_progress_count": p["in_progress_count"],
            "blocked_count": p["blocked_count"],
        }
        for p in active_projects
    ]

    return {
        "page": "dashboard",
        "projects": projects,
    }


# ---------------------------------------------------------------------------
# Per-page renderers  (plain text for LLM injection)
# ---------------------------------------------------------------------------

def _render_kanban(ctx: dict) -> str:
    lines = [f"Active sprint: {ctx['active_sprint_name'] or 'None'}"]
    lines.append(f"In-progress tickets: {ctx['in_progress_count']}")

    blocked = ctx.get("blocked_tickets", [])
    if blocked:
        lines.append(f"Blocked tickets ({len(blocked)} shown, CRITICAL priority):")
        for t in blocked:
            lines.append(f"  [{t['status']}] {t['title']} — assigned to {t['assignee']}")
    else:
        lines.append("Blocked tickets: none")

    bandwidth = ctx.get("team_bandwidth", "").strip()
    if bandwidth:
        lines.append("Team bandwidth (open / high-priority load):")
        for bline in bandwidth.splitlines():
            lines.append(f"  {bline}")

    return "\n".join(lines)


def _render_backlog(ctx: dict) -> str:
    lines = [f"Unassigned open tickets: {ctx['unassigned_count']}"]
    ns = ctx.get("next_sprint")
    if ns:
        start = ns.get("start_date") or "TBD"
        end = ns.get("end_date") or "TBD"
        lines.append(f"Next planned sprint: {ns['name']} ({start} → {end})")
    else:
        lines.append("Next planned sprint: none scheduled")
    return "\n".join(lines)


def _render_wiki(_ctx: dict) -> str:
    return ""


def _render_analytics(ctx: dict) -> str:
    snapshots = ctx.get("snapshots", [])
    if not snapshots:
        return "No analytics data available."

    lines = ["Recent weekly analytics (newest first):"]
    for s in snapshots:
        lines.append(
            f"  Week {s['week_start']}: "
            f"Created {s['created']} | Closed {s['closed']} | "
            f"Avg cycle {s['avg_cycle_days']} days | Velocity {s['velocity']} pts"
        )
    return "\n".join(lines)


def _render_dashboard(ctx: dict) -> str:
    projects = ctx.get("projects", [])
    if not projects:
        return "No active projects."

    lines = ["Active projects overview:"]
    for p in projects:
        lines.append(
            f"  {p['name']}: "
            f"{p['total_tickets']} total | "
            f"{p['blocked_count']} blocked | "
            f"{p['in_progress_count']} in progress"
        )
    return "\n".join(lines)
