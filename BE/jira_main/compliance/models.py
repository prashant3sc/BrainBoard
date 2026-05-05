import uuid

from django.conf import settings
from django.db import models

from issues.models import Issue
from projects.models import Project


class ComplianceTemplate(models.Model):
    """
    Defines a compliance requirement for a project.
    Admins/PMs configure these per project; they optionally gate specific
    status transitions and are scoped to certain issue types.
    """

    PENDING = "pending"
    COMPLETE = "complete"

    ISSUE_TYPE_CHOICES = [
        ("task", "Task"),
        ("subtask", "Subtask"),
        ("bug", "Bug"),
        ("all", "All"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="compliance_templates")
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    # Which issue types this check applies to ("all" means every type)
    applies_to = models.CharField(max_length=20, choices=ISSUE_TYPE_CHOICES, default="all")
    # Comma-separated list of statuses that require this check to be complete first
    # e.g. "done" or "review,done"
    blocks_on = models.CharField(max_length=100, blank=True, default="")
    # Minimum role required to mark this check complete
    required_role = models.CharField(
        max_length=20,
        choices=[("admin", "Admin"), ("pm", "PM"), ("developer", "Developer"), ("viewer", "Viewer")],
        default="developer",
    )
    is_active = models.BooleanField(default=True)
    order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "compliance_templates"
        ordering = ["order", "created_at"]

    def __str__(self):
        return f"{self.project.name} — {self.name}"

    def blocks_transition_to(self, target_status: str) -> bool:
        """Return True if this template blocks the given status transition."""
        if not self.blocks_on:
            return False
        blocked = [s.strip() for s in self.blocks_on.split(",")]
        return target_status in blocked


class ComplianceCheck(models.Model):
    """
    Per-issue instance of a ComplianceTemplate.
    Created automatically when a template is active and the issue type matches.
    """

    PENDING = "pending"
    COMPLETE = "complete"
    BLOCKED = "blocked"
    NOT_REQUIRED = "not_required"

    STATUS_CHOICES = [
        (PENDING, "Pending"),
        (COMPLETE, "Complete"),
        (BLOCKED, "Blocked"),
        (NOT_REQUIRED, "Not Required"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="compliance_checks")
    template = models.ForeignKey(ComplianceTemplate, on_delete=models.CASCADE, related_name="checks")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PENDING)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="completed_compliance_checks",
    )
    note = models.TextField(blank=True, default="")
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "compliance_checks"
        unique_together = ("issue", "template")
        ordering = ["template__order", "template__created_at"]

    def __str__(self):
        return f"[{self.issue.ticket_id}] {self.template.name} — {self.status}"
