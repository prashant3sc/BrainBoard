"""
Post-save signals that keep ChromaDB in sync with Postgres in near-real-time.

Connected from:
  issues.apps.IssuesConfig.ready()
  wiki.apps.WikiConfig.ready()

Celery tasks are dispatched with .delay() so the HTTP call to the FastAPI AI
service never blocks the request/response cycle.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def connect_signals():
    """
    Explicitly register all signal handlers.

    Called once from each AppConfig.ready() that owns a model we care about.
    Using explicit registration (rather than @receiver at module level) avoids
    the risk of double-registration when Django reloads in DEBUG mode.
    """
    from issues.models import Issue, Comment
    from wiki.models import WikiPage

    post_save.connect(_on_issue_saved, sender=Issue, dispatch_uid="embed_issue_post_save")
    post_save.connect(_on_comment_saved, sender=Comment, dispatch_uid="embed_comment_post_save")
    post_save.connect(_on_wiki_page_saved, sender=WikiPage, dispatch_uid="embed_wiki_page_post_save")

    logger.info("AI embedding signals connected.")


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------

def _on_issue_saved(sender, instance, **kwargs):
    """Ticket created or updated → re-embed the full ticket document."""
    from ai_integration.tasks import embed_ticket
    embed_ticket.delay(str(instance.id))


def _on_comment_saved(sender, instance, **kwargs):
    """Comment added/edited → re-embed the parent ticket (includes all comments)."""
    from ai_integration.tasks import embed_ticket
    embed_ticket.delay(str(instance.ticket_id))


def _on_wiki_page_saved(sender, instance, **kwargs):
    """Wiki page created or updated → re-embed the page."""
    from ai_integration.tasks import embed_wiki_page
    embed_wiki_page.delay(str(instance.id))
