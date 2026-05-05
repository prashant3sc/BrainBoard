import json
from collections import defaultdict
from langchain_core.prompts import PromptTemplate
from app.prompts.task_prompts import SPRINT_RETRO_PROMPT
from app.services.rag_pipeline import get_llm
from app.core.logging import get_logger

logger = get_logger(__name__)


def generate_sprint_retro(
    sprint_name: str,
    sprint_goal: str,
    start_date: str,
    end_date: str,
    issues: list[dict],
) -> dict:
    """Call LLM to generate a structured sprint retrospective from completed sprint data."""

    done       = [i for i in issues if i.get("status") == "done"]
    not_done   = [i for i in issues if i.get("status") != "done"]
    blocked    = [i for i in issues if i.get("priority") == "critical" and i.get("status") != "done"]

    points_done  = sum(i.get("story_points") or 0 for i in done)
    points_total = sum(i.get("story_points") or 0 for i in issues)
    pct_complete = round(points_done / points_total * 100, 1) if points_total > 0 else 0

    # Build assignee workload summary
    workload: dict[str, dict] = defaultdict(lambda: {"total": 0, "done": 0, "pts": 0.0})
    for i in issues:
        name = i.get("assignee") or "Unassigned"
        workload[name]["total"] += 1
        if i.get("status") == "done":
            workload[name]["done"] += 1
        workload[name]["pts"] += i.get("story_points") or 0.0

    workload_lines = []
    for name, stats in sorted(workload.items()):
        pct = round(stats["done"] / stats["total"] * 100) if stats["total"] else 0
        workload_lines.append(
            f"- {name}: {stats['done']}/{stats['total']} done ({pct}%) | {stats['pts']} pts"
        )
    assignee_workload = "\n".join(workload_lines) or "No assignee data available."

    # Build per-issue text
    issue_lines = []
    for i in issues:
        pts     = f"{i['story_points']}pts" if i.get("story_points") else "unestimated"
        tid     = f"[{i['ticket_id']}] " if i.get("ticket_id") else ""
        itype   = i.get("issue_type", "task")
        status  = i.get("status", "unknown").upper()
        prio    = i.get("priority", "medium")
        name    = i.get("assignee") or "Unassigned"
        issue_lines.append(
            f"- [{status}] {tid}{i['title']} | type={itype} | priority={prio} | {pts} | assignee={name}"
        )
    issues_text = "\n".join(issue_lines) if issue_lines else "No issues found in this sprint."

    llm = get_llm(model_key="chat")
    prompt = PromptTemplate(
        template=SPRINT_RETRO_PROMPT,
        input_variables=[
            "sprint_name", "sprint_goal", "start_date", "end_date",
            "done", "not_done", "total",
            "points_done", "points_total", "pct_complete",
            "blocked_count", "spillover_count",
            "assignee_workload", "issues_text",
        ],
    )
    chain = prompt | llm
    response = chain.invoke({
        "sprint_name":      sprint_name,
        "sprint_goal":      sprint_goal or "No goal set",
        "start_date":       start_date or "N/A",
        "end_date":         end_date   or "N/A",
        "done":             len(done),
        "not_done":         len(not_done),
        "total":            len(issues),
        "points_done":      points_done,
        "points_total":     points_total,
        "pct_complete":     pct_complete,
        "blocked_count":    len(blocked),
        "spillover_count":  len(not_done),
        "assignee_workload": assignee_workload,
        "issues_text":      issues_text,
    })

    logger.info(
        f"Sprint retro generated for '{sprint_name}' | "
        f"{len(done)}/{len(issues)} done | {len(not_done)} carry-forward"
    )
    return json.loads(response.content)
