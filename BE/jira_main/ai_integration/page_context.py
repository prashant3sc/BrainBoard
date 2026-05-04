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
    from collections import defaultdict

    today = date.today()
    stale_cutoff = today - timedelta(days=3)

    # ── Resolve sprint ────────────────────────────────────────────────────
    sprint_obj = None
    sprint_filter: dict = {}

    if sprint_id:
        try:
            sprint_obj = Sprint.objects.get(pk=sprint_id)
            sprint_filter = {"sprint_id": sprint_id}
        except Sprint.DoesNotExist:
            pass
    elif project_id:
        try:
            sprint_obj = Sprint.objects.get(project_id=project_id, status=Sprint.ACTIVE)
            sprint_filter = {"sprint_id": str(sprint_obj.id)}
        except Sprint.DoesNotExist:
            pass

    sprint_meta: dict = {}
    if sprint_obj:
        days_remaining = None
        if sprint_obj.end_date:
            days_remaining = max(0, (sprint_obj.end_date - today).days)
        sprint_meta = {
            "id":            str(sprint_obj.id),
            "name":          sprint_obj.name,
            "goal":          sprint_obj.goal or "",
            "status":        sprint_obj.status,
            "start_date":    str(sprint_obj.start_date) if sprint_obj.start_date else None,
            "end_date":      str(sprint_obj.end_date)   if sprint_obj.end_date   else None,
            "days_remaining": days_remaining,
        }

    # ── Fetch ALL sprint issues in ONE query ──────────────────────────────
    if sprint_filter:
        base_qs = Issue.objects.filter(**sprint_filter)
    elif project_id:
        base_qs = Issue.objects.filter(project_id=project_id)
    else:
        base_qs = Issue.objects.none()

    all_issues = list(
        base_qs
        .select_related("assignee", "project")
        .only(
            "id", "title", "status", "priority", "issue_type",
            "story_points", "due_date", "created_at", "updated_at", "sequence_number",
            "assignee_id",
            "assignee__first_name", "assignee__last_name", "assignee__email",
            "project_id", "project__key",
        )
        .order_by("status", "-priority", "title")
    )

    # ── Helpers ───────────────────────────────────────────────────────────
    def _assignee(issue: Issue) -> str:
        if not issue.assignee:
            return "Unassigned"
        return issue.assignee.get_full_name().strip() or issue.assignee.email

    def _ticket_id(issue: Issue) -> str:
        try:
            if issue.project.key and issue.sequence_number:
                return f"{issue.project.key}-{issue.sequence_number}"
        except Exception:
            pass
        return str(issue.id)[:8]

    def _rec(issue: Issue) -> dict:
        return {
            "ticket_id":   _ticket_id(issue),
            "title":       issue.title,
            "status":      issue.status,
            "priority":    issue.priority,
            "issue_type":  issue.issue_type,
            "assignee":    _assignee(issue),
            "story_points": f"{issue.story_points}sp" if issue.story_points else "?",
            "due_date":    str(issue.due_date)          if issue.due_date    else None,
            "updated_at":  str(issue.updated_at.date()) if issue.updated_at  else None,
        }

    # ── Derive everything from memory — zero extra DB queries ─────────────
    open_issues        = [i for i in all_issues if i.status != Issue.DONE]
    done_issues        = [i for i in all_issues if i.status == Issue.DONE]
    todo_issues        = [i for i in all_issues if i.status == Issue.TODO]
    in_progress_issues = [i for i in all_issues if i.status == Issue.IN_PROGRESS]
    review_issues      = [i for i in all_issues if i.status == Issue.REVIEW]

    total_sp     = sum(i.story_points or 0 for i in all_issues)
    done_sp      = sum(i.story_points or 0 for i in done_issues)
    remaining_sp = max(0, total_sp - done_sp)
    unestimated_open = sum(1 for i in open_issues if not i.story_points)

    sprint_start = sprint_obj.start_date if sprint_obj else None

    blocked             = [i for i in open_issues if i.priority == Issue.CRITICAL]
    at_risk             = [i for i in open_issues if i.priority == Issue.HIGH]
    overdue             = [i for i in open_issues if i.due_date and i.due_date < today]
    aging               = [i for i in open_issues
                           if i.updated_at and i.updated_at.date() <= stale_cutoff]
    in_progress_stale   = [i for i in in_progress_issues
                           if i.updated_at and i.updated_at.date() <= stale_cutoff]
    done_today          = [i for i in done_issues
                           if i.updated_at and i.updated_at.date() == today]
    updated_today       = [i for i in open_issues
                           if i.updated_at and i.updated_at.date() == today]
    added_mid_sprint    = [i for i in all_issues
                           if sprint_start and i.created_at
                           and i.created_at.date() > sprint_start]
    unassigned_open     = [i for i in open_issues if not i.assignee]

    bug_total = sum(1 for i in all_issues    if i.issue_type == Issue.BUG)
    bug_open  = sum(1 for i in open_issues   if i.issue_type == Issue.BUG)
    task_open = sum(1 for i in open_issues   if i.issue_type == Issue.TASK)

    # Average cycle time for done items
    cycle_days = [
        (i.updated_at.date() - i.created_at.date()).days
        for i in done_issues
        if i.updated_at and i.created_at
        and i.updated_at.date() >= i.created_at.date()
    ]
    avg_cycle = round(sum(cycle_days) / len(cycle_days), 1) if cycle_days else None

    # Assignee workload
    workload_map: dict = defaultdict(int)
    for i in open_issues:
        workload_map[_assignee(i)] += 1
    assignee_workload = sorted(
        [{"name": k, "open_count": v} for k, v in workload_map.items() if k != "Unassigned"],
        key=lambda x: -x["open_count"],
    )

    return {
        "page": "kanban",
        "sprint": sprint_meta,
        "column_counts": {
            "todo":        len(todo_issues),
            "in_progress": len(in_progress_issues),
            "review":      len(review_issues),
            "done":        len(done_issues),
        },
        "story_points": {
            "total":            total_sp,
            "done":             done_sp,
            "remaining":        remaining_sp,
            "unestimated_open": unestimated_open,
        },
        "issue_types": {
            "bug_total": bug_total,
            "bug_open":  bug_open,
            "task_open": task_open,
        },
        "avg_cycle_days":       avg_cycle,
        "unassigned_open":      len(unassigned_open),
        "overdue_count":        len(overdue),
        "blocked_tickets":      [_rec(i) for i in blocked[:10]],
        "at_risk_tickets":      [_rec(i) for i in at_risk[:5]],
        "overdue_tickets":      [_rec(i) for i in overdue[:5]],
        "aging_tickets":        [_rec(i) for i in aging[:5]],
        "in_progress_stale":    [_rec(i) for i in in_progress_stale[:5]],
        "review_items":         [_rec(i) for i in review_issues[:10]],
        "done_today":           [_rec(i) for i in done_today[:10]],
        "updated_today":        [_rec(i) for i in updated_today[:10]],
        "added_mid_sprint":     [_rec(i) for i in added_mid_sprint[:10]],
        "assignee_workload":    assignee_workload,
        "all_issues":           [_rec(i) for i in all_issues[:100]],
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
    lines = []

    def _issue_line(t: dict) -> str:
        due = f" | due {t['due_date']}" if t.get("due_date") else ""
        return (
            f"  [{t['status']}] {t['ticket_id']} {t['title']} — "
            f"{t['priority']} | {t['issue_type']} | {t['assignee']} | {t['story_points']}{due}"
        )

    # ── Sprint overview ───────────────────────────────────────────────────
    sprint = ctx.get("sprint") or {}
    if sprint:
        lines.append(f"Sprint: {sprint['name']}")
        if sprint.get("goal"):
            lines.append(f"Sprint goal: {sprint['goal']}")
        lines.append(f"Sprint status: {sprint['status']}")
        if sprint.get("start_date") and sprint.get("end_date"):
            lines.append(f"Sprint dates: {sprint['start_date']} → {sprint['end_date']}")
        if sprint.get("days_remaining") is not None:
            lines.append(f"Days remaining: {sprint['days_remaining']}")
    else:
        lines.append("No active sprint.")

    # ── Board column counts ───────────────────────────────────────────────
    cols = ctx.get("column_counts", {})
    total_issues = sum(cols.values())
    lines.append(
        f"Board: {cols.get('todo', 0)} To Do | {cols.get('in_progress', 0)} In Progress | "
        f"{cols.get('review', 0)} In Review | {cols.get('done', 0)} Done  ({total_issues} total)"
    )

    # ── Story points (always shown) ───────────────────────────────────────
    sp = ctx.get("story_points", {})
    total_sp = sp.get("total") or 0
    done_sp  = sp.get("done") or 0
    pct      = round(done_sp / total_sp * 100) if total_sp else 0
    if total_sp:
        lines.append(
            f"Story points: {done_sp} done / {total_sp} total ({pct}%), "
            f"{sp.get('remaining', 0)} remaining"
        )
    else:
        lines.append("Story points: not estimated (all issues unestimated)")
    if sp.get("unestimated_open"):
        lines.append(f"Unestimated open items: {sp['unestimated_open']}")

    # ── Issue type summary ────────────────────────────────────────────────
    it = ctx.get("issue_types", {})
    if it.get("bug_total"):
        fixed = it["bug_total"] - it["bug_open"]
        lines.append(f"Bugs: {it['bug_open']} open, {fixed} fixed (total {it['bug_total']})")
    if ctx.get("avg_cycle_days") is not None:
        lines.append(f"Avg cycle time (done items): {ctx['avg_cycle_days']} days")
    if ctx.get("unassigned_open"):
        lines.append(f"Unassigned open items: {ctx['unassigned_open']}")
    if ctx.get("overdue_count"):
        lines.append(f"Overdue items: {ctx['overdue_count']}")

    # ── Today's activity ──────────────────────────────────────────────────
    done_today = ctx.get("done_today", [])
    if done_today:
        titles = ", ".join(f"{t['ticket_id']} {t['title']}" for t in done_today)
        lines.append(f"Completed today ({len(done_today)}): {titles}")
    updated_today = ctx.get("updated_today", [])
    if updated_today:
        ids = ", ".join(t["ticket_id"] for t in updated_today)
        lines.append(f"Updated today (open): {ids}")

    # ── Mid-sprint additions ──────────────────────────────────────────────
    added = ctx.get("added_mid_sprint", [])
    if added:
        lines.append(f"Added after sprint start ({len(added)}):")
        for t in added:
            lines.append(f"  {t['ticket_id']} {t['title']} — {t['priority']} | {t['assignee']}")

    # ── Blocked ───────────────────────────────────────────────────────────
    blocked = ctx.get("blocked_tickets", [])
    if blocked:
        lines.append(f"Blocked (CRITICAL, not done — {len(blocked)}):")
        for t in blocked:
            lines.append(_issue_line(t))
    else:
        lines.append("Blocked items: none")

    # ── At-risk ───────────────────────────────────────────────────────────
    at_risk = ctx.get("at_risk_tickets", [])
    if at_risk:
        lines.append(f"At-risk (HIGH priority, not done — {len(at_risk)}):")
        for t in at_risk:
            lines.append(_issue_line(t))

    # ── In review ─────────────────────────────────────────────────────────
    review_items = ctx.get("review_items", [])
    if review_items:
        lines.append(f"In review ({len(review_items)}):")
        for t in review_items:
            lines.append(f"  {t['ticket_id']} {t['title']} — {t['assignee']}")

    # ── Overdue ───────────────────────────────────────────────────────────
    overdue = ctx.get("overdue_tickets", [])
    if overdue:
        lines.append(f"Overdue ({len(overdue)}):")
        for t in overdue:
            lines.append(f"  [{t['status']}] {t['ticket_id']} {t['title']} — due {t['due_date']} — {t['assignee']}")

    # ── In progress too long ──────────────────────────────────────────────
    ipt = ctx.get("in_progress_stale", [])
    if ipt:
        lines.append(f"In progress too long (no update 3+ days — {len(ipt)}):")
        for t in ipt:
            lines.append(f"  {t['ticket_id']} {t['title']} — last updated {t['updated_at']} — {t['assignee']}")

    # ── Aging / stale ─────────────────────────────────────────────────────
    aging = ctx.get("aging_tickets", [])
    if aging:
        lines.append(f"Stale items (any status, no activity 3+ days — {len(aging)}):")
        for t in aging:
            lines.append(f"  [{t['status']}] {t['ticket_id']} {t['title']} — last updated {t['updated_at']} — {t['assignee']}")

    # ── Assignee workload ─────────────────────────────────────────────────
    workload = ctx.get("assignee_workload", [])
    if workload:
        lines.append("Assignee workload (open items):")
        for w in workload:
            lines.append(f"  {w['name']}: {w['open_count']} open")

    # ── Full sprint issue list ────────────────────────────────────────────
    all_issues = ctx.get("all_issues", [])
    if all_issues:
        lines.append(f"\nALL SPRINT ISSUES ({len(all_issues)} total):")
        lines.append("  Format: [status] TICKET Title — priority | type | assignee | points | due")
        for t in all_issues:
            lines.append(_issue_line(t))

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
