import json
from langchain_core.prompts import PromptTemplate
from app.prompts.task_prompts import SPRINT_PULSE_PROMPT
from app.services.rag_pipeline import get_llm
from app.core.logging import get_logger

logger = get_logger(__name__)


def generate_sprint_pulse(
    sprint_name: str,
    start_date: str,
    end_date: str,
    done: int,
    in_progress: int,
    review: int,
    todo: int,
    points_burned: float,
    points_total: float,
    issues: list[dict],
) -> dict:
    """Call LLM to generate sprint summary + highlights from real sprint data."""

    issues_lines = []
    for i in issues:
        pts = f"{i['story_points']}pts" if i.get("story_points") else "unestimated"
        labels = ", ".join(i.get("labels") or []) or "none"
        assignee = i.get("assignee") or "Unassigned"
        issues_lines.append(
            f"- [{i['status'].upper()}] {i['title']} "
            f"| priority={i['priority']} | {pts} | labels={labels} | assignee={assignee}"
        )
    issues_text = "\n".join(issues_lines) if issues_lines else "No issues found in this sprint."

    llm = get_llm(model_key="chat")
    prompt = PromptTemplate(
        template=SPRINT_PULSE_PROMPT,
        input_variables=[
            "sprint_name", "start_date", "end_date",
            "done", "in_progress", "review", "todo",
            "points_burned", "points_total", "issues_text",
        ],
    )
    chain = prompt | llm
    response = chain.invoke({
        "sprint_name":    sprint_name,
        "start_date":     start_date,
        "end_date":       end_date,
        "done":           done,
        "in_progress":    in_progress,
        "review":         review,
        "todo":           todo,
        "points_burned":  points_burned,
        "points_total":   points_total,
        "issues_text":    issues_text,
    })

    logger.info(f"Sprint pulse generated for sprint '{sprint_name}'")
    return json.loads(response.content)
