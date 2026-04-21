"""
Agents Package — JiraGenie AI

This package contains autonomous AI agents that perform specific tasks within the system.
Each agent inherits from BaseAgent and implements the `run()` method.

Future agents planned:
- SprintPlanningAgent: Auto-generates sprint plans from a backlog.
- AutoAssignmentAgent: Automatically assigns tasks when a new Jira issue is created.
- NotificationAgent: Sends Slack/email notifications on task assignments.
- RCAAgent: Runs root cause analysis pipelines on reported issues.
"""
from app.services.agents.base_agent import BaseAgent

__all__ = ["BaseAgent"]
