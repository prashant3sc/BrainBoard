from django.conf import settings
from django.db import models

from issues.models import Issue
from projects.models import Project


class WikiSpace(models.Model):
    """Top-level namespace within a project (Spaces → Pages → Sub-pages)."""

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
