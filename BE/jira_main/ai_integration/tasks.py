"""
Celery embedding tasks for BrainBoard.

Each task builds a plain-text representation of a database object, then calls
the FastAPI AI service's /embed/upsert endpoint to (re-)embed it in ChromaDB.

Doc-ID convention (deterministic, stable across upserts):
  ticket_<issue_uuid>
  wiki_<page_uuid>
  sprint_<sprint_uuid>
  analytics_<project_uuid>_<week_start_iso>   e.g. analytics_abc123_2025-04-21
"""

from __future__ import annotations

import logging
import requests
from datetime import date, timedelta

from celery import shared_task

from . import ai_client

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# embed_ticket
# ---------------------------------------------------------------------------

@shared_task(
    name="ai_integration.tasks.embed_ticket",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def embed_ticket(self, ticket_id: str) -> dict:
    """
    Fetch a ticket (issue) from Postgres and upsert its embedding in ChromaDB.

    Includes assignee, reporter, sprint, labels, and all comments so that
    natural-language queries ("who is working on X" / "what did we discuss
    about Y") can retrieve the correct ticket.
    """
    from issues.models import Issue, Comment  # local import avoids circular refs at import time

    try:
        issue = (
            Issue.objects
            .select_related("project", "assignee", "reporter", "sprint")
            .prefetch_related("labels", "comments__author")
            .get(pk=ticket_id)
        )
    except Issue.DoesNotExist:
        logger.warning(f"embed_ticket: Issue {ticket_id} not found — skipping")
        return {"status": "skipped", "reason": "not_found"}

    assignee_name = ""
    if issue.assignee:
        assignee_name = issue.assignee.get_full_name().strip() or issue.assignee.email

    reporter_name = ""
    if issue.reporter:
        reporter_name = issue.reporter.get_full_name().strip() or issue.reporter.email

    sprint_name = issue.sprint.name if issue.sprint else "No sprint"

    labels = ", ".join(issue.labels.values_list("name", flat=True)) or "none"

    comments_text = "\n".join(
        f"{c.author.get_full_name().strip() if c.author else 'Unknown'}: {c.body}"
        for c in issue.comments.all()
    ) or "No comments"

    text = (
        f"Title: {issue.title}\n"
        f"Description: {issue.description or '(no description)'}\n"
        f"Status: {issue.status} | Priority: {issue.priority} | Type: {issue.issue_type}\n"
        f"Assignee: {assignee_name or 'Unassigned'} | Reporter: {reporter_name or 'Unknown'}\n"
        f"Sprint: {sprint_name} | Labels: {labels}\n"
        f"Comments:\n{comments_text}"
    )

    metadata = {
        "type": "ticket",
        "ticket_id": str(issue.id),
        "project_id": str(issue.project_id),
        "sprint_id": str(issue.sprint_id) if issue.sprint_id else "",
        "status": issue.status,
        "priority": issue.priority,
        "assignee_id": str(issue.assignee_id) if issue.assignee_id else "",
        "updated_at": issue.updated_at.isoformat(),
    }

    doc_id = f"ticket_{issue.id}"

    try:
        result = ai_client.embed_upsert(doc_id, text, metadata)
        logger.info(f"embed_ticket: upserted {doc_id}")
        return result
    except requests.RequestException as exc:
        logger.error(f"embed_ticket: AI service unreachable for {doc_id}: {exc}")
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# embed_wiki_page
# ---------------------------------------------------------------------------

@shared_task(
    name="ai_integration.tasks.embed_wiki_page",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
)
def embed_wiki_page(self, page_id: str) -> dict:
    """
    Fetch a WikiPage from Postgres and upsert its embedding in ChromaDB.
    """
    from wiki.models import WikiPage  # local import

    try:
        page = (
            WikiPage.objects
            .select_related("project", "space", "parent", "created_by")
            .get(pk=page_id)
        )
    except WikiPage.DoesNotExist:
        logger.warning(f"embed_wiki_page: WikiPage {page_id} not found — skipping")
        return {"status": "skipped", "reason": "not_found"}

    text = f"Page: {page.title}\n\n{page.content or '(no content)'}"

    metadata = {
        "type": "wiki",
        "page_id": str(page.id),
        "project_id": str(page.project_id),
        "updated_at": page.updated_at.isoformat(),
    }

    doc_id = f"wiki_{page.id}"

    try:
        result = ai_client.embed_upsert(doc_id, text, metadata)
        logger.info(f"embed_wiki_page: upserted {doc_id}")
        return result
    except requests.RequestException as exc:
        logger.error(f"embed_wiki_page: AI service unreachable for {doc_id}: {exc}")
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# embed_sprint_summary
# ---------------------------------------------------------------------------

@shared_task(
    name="ai_integration.tasks.embed_sprint_summary",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def embed_sprint_summary(self, sprint_id: str) -> dict:
    """
    Fetch a Sprint and all its issues; build a summary embedding in ChromaDB.

    "Blocked" is approximated as CRITICAL-priority issues that are not DONE,
    because the Issue model has no explicit BLOCKED status field.
    """
    from issues.models import Issue
    from projects.models import Sprint  # local import

    try:
        sprint = Sprint.objects.select_related("project").get(pk=sprint_id)
    except Sprint.DoesNotExist:
        logger.warning(f"embed_sprint_summary: Sprint {sprint_id} not found — skipping")
        return {"status": "skipped", "reason": "not_found"}

    issues = Issue.objects.filter(sprint=sprint)

    total = issues.count()
    done = issues.filter(status=Issue.DONE).count()
    in_progress = issues.filter(status=Issue.IN_PROGRESS).count()
    # "Blocked" = CRITICAL priority tickets not yet done
    blocked = issues.filter(priority=Issue.CRITICAL).exclude(status=Issue.DONE).count()
    story_points = sum(i.story_points or 0 for i in issues)

    start_str = str(sprint.start_date) if sprint.start_date else "TBD"
    end_str = str(sprint.end_date) if sprint.end_date else "TBD"

    text = (
        f"Sprint: {sprint.name} | {start_str} to {end_str}\n"
        f"Total: {total} | Done: {done} | Blocked: {blocked} | In Progress: {in_progress}\n"
        f"Velocity: {story_points} points"
    )

    is_active = "true" if sprint.status == Sprint.ACTIVE else "false"

    # ISO week of the sprint start date (or current week as fallback)
    week_ref = sprint.start_date or date.today()
    week_str = week_ref.strftime("%Y-W%V")

    metadata = {
        "type": "sprint",
        "sprint_id": str(sprint.id),
        "project_id": str(sprint.project_id),
        "is_active": is_active,
        "week": week_str,
    }

    doc_id = f"sprint_{sprint.id}"

    try:
        result = ai_client.embed_upsert(doc_id, text, metadata)
        logger.info(f"embed_sprint_summary: upserted {doc_id}")
        return result
    except requests.RequestException as exc:
        logger.error(f"embed_sprint_summary: AI service unreachable for {doc_id}: {exc}")
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# embed_analytics_snapshot
# ---------------------------------------------------------------------------

@shared_task(
    name="ai_integration.tasks.embed_analytics_snapshot",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def embed_analytics_snapshot(self, project_id: str, week_start: str) -> dict:
    """
    Compute a weekly analytics snapshot from Postgres and upsert it into ChromaDB.

    Args:
        project_id: UUID string of the project.
        week_start: ISO date string of Monday (e.g. "2025-04-21").

    Metrics computed:
        - tickets created in the week
        - tickets closed (status=DONE, updated in the week)
        - avg cycle time = mean(updated_at − created_at) for DONE tickets closed this week
        - velocity = sum of story_points for DONE tickets closed this week
    """
    from issues.models import Issue
    from projects.models import Project
    from django.utils.timezone import make_aware
    from datetime import datetime

    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        logger.warning(f"embed_analytics_snapshot: Project {project_id} not found — skipping")
        return {"status": "skipped", "reason": "not_found"}

    week_start_date = date.fromisoformat(week_start)
    week_end_date = week_start_date + timedelta(days=6)

    # Make tz-aware datetimes for queryset filtering (USE_TZ=True in settings)
    try:
        week_start_dt = make_aware(datetime.combine(week_start_date, datetime.min.time()))
        week_end_dt = make_aware(datetime.combine(week_end_date, datetime.max.time()))
    except Exception:
        # Fallback: naive datetime if TZ causes issues in tests
        week_start_dt = datetime.combine(week_start_date, datetime.min.time())
        week_end_dt = datetime.combine(week_end_date, datetime.max.time())

    base_qs = Issue.objects.filter(project=project)

    created = base_qs.filter(created_at__range=(week_start_dt, week_end_dt)).count()

    closed_qs = base_qs.filter(
        status=Issue.DONE,
        updated_at__range=(week_start_dt, week_end_dt),
    )
    closed = closed_qs.count()

    # Avg cycle time in days (updated_at - created_at for closed tickets this week)
    cycle_times = [
        (i.updated_at - i.created_at).days
        for i in closed_qs.only("created_at", "updated_at")
        if i.updated_at >= i.created_at
    ]
    avg_cycle_days = round(sum(cycle_times) / len(cycle_times), 1) if cycle_times else 0

    velocity = sum(i.story_points or 0 for i in closed_qs.only("story_points"))

    text = (
        f"Week of {week_start}. Project: {project.name}\n"
        f"Created: {created} | Closed: {closed}\n"
        f"Avg cycle time: {avg_cycle_days} days | Velocity: {velocity} points"
    )

    metadata = {
        "type": "analytics",
        "project_id": str(project.id),
        "week": week_start,
        "snapshot_date": date.today().isoformat(),
    }

    doc_id = f"analytics_{project.id}_{week_start}"

    try:
        result = ai_client.embed_upsert(doc_id, text, metadata)
        logger.info(f"embed_analytics_snapshot: upserted {doc_id}")
        return result
    except requests.RequestException as exc:
        logger.error(f"embed_analytics_snapshot: AI service unreachable for {doc_id}: {exc}")
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Beat wrapper tasks  — called on the Monday 09:00 schedule
# ---------------------------------------------------------------------------

@shared_task(name="ai_integration.tasks.embed_all_active_sprints")
def embed_all_active_sprints() -> dict:
    """
    Celery beat entry point: fans out embed_sprint_summary for every ACTIVE sprint.
    """
    from projects.models import Sprint  # local import

    sprint_ids = list(
        Sprint.objects.filter(status=Sprint.ACTIVE).values_list("id", flat=True)
    )
    for sid in sprint_ids:
        embed_sprint_summary.delay(str(sid))

    logger.info(f"embed_all_active_sprints: queued {len(sprint_ids)} sprint(s)")
    return {"queued_sprints": len(sprint_ids)}


@shared_task(name="ai_integration.tasks.embed_all_active_project_analytics")
def embed_all_active_project_analytics() -> dict:
    """
    Celery beat entry point: fans out embed_analytics_snapshot for every active project.
    Uses the Monday of the current week as `week_start`.
    """
    from projects.models import Project  # local import

    today = date.today()
    # Roll back to Monday (weekday() == 0)
    monday = today - timedelta(days=today.weekday())
    week_start = monday.isoformat()

    project_ids = list(
        Project.objects.filter(is_archived=False).values_list("id", flat=True)
    )
    for pid in project_ids:
        embed_analytics_snapshot.delay(str(pid), week_start)

    logger.info(
        f"embed_all_active_project_analytics: queued {len(project_ids)} project(s) "
        f"for week {week_start}"
    )
    return {"queued_projects": len(project_ids), "week_start": week_start}
