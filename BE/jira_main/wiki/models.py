import uuid

from django.conf import settings
from django.db import models

from issues.models import Issue
from projects.models import Project


PROCESS_CATEGORY_CHOICES = [
    ("process",   "Process"),
    ("standard",  "Standard"),
    ("runbook",   "Runbook"),
    ("checklist", "Checklist"),
]

TRIGGER_CONTEXT_CHOICES = [
    ("issue_creation",    "Issue Creation"),
    ("issue_view",        "Issue View"),
    ("sprint_completion", "Sprint Completion"),
    ("release_task",      "Release Task"),
    ("incident",          "Incident"),
    ("bug",               "Bug"),
    ("pr_review",         "PR Review"),
    ("definition_of_done","Definition of Done"),
]

ISSUE_TYPE_SCOPE_CHOICES = [
    ("task",    "Task"),
    ("subtask", "Subtask"),
    ("bug",     "Bug"),
    ("all",     "All"),
]


class WikiSpace(models.Model):
    """Top-level namespace within a project (Spaces → Pages → Sub-pages)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="wiki_spaces")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_spaces",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wiki_spaces"

    def __str__(self):
        return f"{self.project.name} / {self.name}"


class WikiPage(models.Model):
    """A wiki page with optional parent for hierarchy."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=500)
    content = models.TextField(blank=True, default="")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="wiki_pages")
    space = models.ForeignKey(
        WikiSpace,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pages",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_wiki_pages",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="updated_wiki_pages",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wiki_pages"
        ordering = ["title"]

    def __str__(self):
        return f"{self.project.name} / {self.title}"


class WikiPageVersion(models.Model):
    """Immutable snapshot of a wiki page at a point in time (version history)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    page = models.ForeignKey(WikiPage, on_delete=models.CASCADE, related_name="versions")
    title = models.CharField(max_length=500)
    content = models.TextField()
    version_number = models.PositiveIntegerField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="wiki_versions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "wiki_page_versions"
        unique_together = ("page", "version_number")
        ordering = ["-version_number"]

    def __str__(self):
        return f"{self.page.title} v{self.version_number}"


class TicketPageLink(models.Model):
    """Cross-link between an Issue (ticket) and a WikiPage."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    issue = models.ForeignKey(Issue, on_delete=models.CASCADE, related_name="wiki_links")
    wiki_page = models.ForeignKey(WikiPage, on_delete=models.CASCADE, related_name="issue_links")
    linked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_ticket_links",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ticket_page_links"
        unique_together = ("issue", "wiki_page")

    def __str__(self):
        return f"Issue#{self.issue_id} ↔ WikiPage#{self.wiki_page_id}"


class ProcessDefinition(models.Model):
    """
    Marks a WikiPage as a process definition and attaches workflow metadata.
    The wiki page remains the source of truth; this model stores routing/context
    info so BrainBoard can surface the right process at the right moment.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wiki_page = models.OneToOneField(
        WikiPage,
        on_delete=models.CASCADE,
        related_name="process_definition",
    )
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name="process_definitions",
    )
    category = models.CharField(
        max_length=20,
        choices=PROCESS_CATEGORY_CHOICES,
        default="process",
    )
    # JSON arrays stored as lists
    trigger_contexts = models.JSONField(
        default=list,
        help_text="List of trigger context keys, e.g. ['issue_view', 'bug']",
    )
    issue_type_scope = models.JSONField(
        default=list,
        help_text="Issue types this applies to. Empty list = all types.",
    )
    short_description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)
    priority = models.PositiveSmallIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_process_definitions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "process_definitions"
        ordering = ["priority", "created_at"]

    def __str__(self):
        return f"[{self.get_category_display()}] {self.wiki_page.title}"

    def matches_context(self, context: str, issue_type: str | None = None) -> bool:
        """Return True if this definition should surface in the given context."""
        if not self.is_active:
            return False
        if context not in (self.trigger_contexts or []):
            return False
        if self.issue_type_scope and issue_type:
            return issue_type in self.issue_type_scope or "all" in self.issue_type_scope
        return True
