import uuid

from django.conf import settings
from django.db import models

from projects.models import Project, Sprint


class Label(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    color = models.CharField(max_length=7, default="#2DD836DA")  # hex color
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="labels")

    class Meta:
        db_table = "labels"
        unique_together = ("name", "project")

    def __str__(self):
        return f"{self.name} [{self.project.name}]"


class Issue(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Status choices — maps to frontend IssueStatus type
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"

    STATUS_CHOICES = [
        (TODO, "To Do"),
        (IN_PROGRESS, "In Progress"),
        (REVIEW, "Review"),
        (DONE, "Done"),
    ]

    # Priority choices — maps to frontend Priority type
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

    PRIORITY_CHOICES = [
        (CRITICAL, "Critical"),
        (HIGH, "High"),
        (MEDIUM, "Medium"),
        (LOW, "Low"),
    ]

    # Issue type choices
    TASK = "task"
    SUBTASK = "subtask"
    BUG = "bug"

    ISSUE_TYPE_CHOICES = [
        (TASK, "Task"),
        (SUBTASK, "Subtask"),
        (BUG, "Bug"),
    ]

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=TODO)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default=MEDIUM)
    issue_type = models.CharField(max_length=20, choices=ISSUE_TYPE_CHOICES, default=TASK)
    story_points = models.PositiveIntegerField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    parent = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subtasks",
    )

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="project_issues")
    sprint = models.ForeignKey(
        Sprint,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sprint_issues",
    )
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_issues",
    )
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="reported_issues",
    )
    labels = models.ManyToManyField(Label, blank=True, related_name="labels_issues")

    sequence_number = models.PositiveIntegerField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "issues"
        ordering = ["-created_at"]
        unique_together = [("project", "sequence_number")]

    @property
    def ticket_id(self):
        if self.project.key and self.sequence_number:
            return f"{self.project.key}-{self.sequence_number}"
        return None

    def __str__(self):
        return f"[{self.project.key or self.project.name}] {self.ticket_id or self.title}"


class Comment(models.Model):
    """A comment left on a ticket (issue)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Named `ticket` so signal handlers can reference `instance.ticket_id`
    ticket = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="comments",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "issue_comments"
        ordering = ["created_at"]

    def __str__(self):
        return f"Comment on [{self.ticket.project.name}] {self.ticket.title}"
