import uuid

from django.conf import settings
from django.db import models

from projects.models import Project


class WorkflowTemplate(models.Model):
    """
    System-wide or project-scoped template for project setup, issue creation,
    or wiki page creation.

    System templates have project=None and is_system=True.
    Project-level custom templates have project=<FK> and is_system=False.
    """

    PROJECT = "project"
    ISSUE   = "issue"
    WIKI    = "wiki"

    TEMPLATE_TYPE_CHOICES = [
        (PROJECT, "Project Setup"),
        (ISSUE,   "Issue"),
        (WIKI,    "Wiki Page"),
    ]

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project       = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="workflow_templates",
    )
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPE_CHOICES)
    name          = models.CharField(max_length=200)
    description   = models.TextField(blank=True, default="")
    icon          = models.CharField(max_length=10, blank=True, default="")
    category      = models.CharField(max_length=50, blank=True, default="")
    is_active     = models.BooleanField(default=True)
    is_system     = models.BooleanField(default=False)
    # Structured payload — shape depends on template_type (see docs)
    config        = models.JSONField(default=dict)
    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_templates",
    )
    order         = models.PositiveSmallIntegerField(default=0)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workflow_templates"
        ordering = ["order", "created_at"]

    def __str__(self):
        scope = self.project.name if self.project else "System"
        return f"[{scope}] {self.name} ({self.template_type})"
