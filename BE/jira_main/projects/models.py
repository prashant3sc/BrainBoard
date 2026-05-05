import uuid

from django.conf import settings
from django.db import models


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    key = models.CharField(max_length=6, unique=True, null=True, blank=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="owned_projects",
    )
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "projects"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name


class ProjectMember(models.Model):
    """Tracks which users are members of a project (beyond global role)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_memberships",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "project_members"
        unique_together = ("project", "user")

    def __str__(self):
        return f"{self.user} → {self.project}"


class Sprint(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    PLANNED = "planned"
    ACTIVE = "active"
    COMPLETED = "completed"

    STATUS_CHOICES = [
        (PLANNED, "Planned"),
        (ACTIVE, "Active"),
        (COMPLETED, "Completed"),
    ]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="sprints")
    name = models.CharField(max_length=255)
    goal = models.TextField(blank=True, default="")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=PLANNED)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "sprints"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.project.name} / {self.name}"


class SprintRetro(models.Model):
    """Stores AI-generated (and optionally user-edited) sprint retrospectives."""

    CONFIDENCE_CHOICES = [
        ("high",   "High"),
        ("medium", "Medium"),
        ("low",    "Low"),
    ]

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sprint           = models.OneToOneField(Sprint, on_delete=models.CASCADE, related_name="retro")
    sprint_name      = models.CharField(max_length=255)
    summary          = models.TextField(blank=True, default="")
    wins             = models.JSONField(default=list)
    bottlenecks      = models.JSONField(default=list)
    repeated_blockers = models.JSONField(default=list)
    scope_changes    = models.JSONField(default=list)
    workload_notes   = models.JSONField(default=list)
    patterns         = models.JSONField(default=list)
    action_items     = models.JSONField(default=list)
    confidence       = models.CharField(max_length=10, choices=CONFIDENCE_CHOICES, default="medium")
    confidence_reason = models.TextField(blank=True, default="")
    created_by       = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="sprint_retros",
    )
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "sprint_retros"

    def __str__(self):
        return f"Retro: {self.sprint_name}"
