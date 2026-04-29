from django.urls import path

from wiki.views import (
    KBAnalyticsView,
    ProjectWikiListView,
    TicketPageLinkView,
    WikiPageDetailView,
    WikiPageHistoryView,
    WikiPageListView,
)

urlpatterns = [
    path("projects/<uuid:project_id>/wiki", ProjectWikiListView.as_view(), name="project-wiki-list"),
    path("wiki", WikiPageListView.as_view(), name="wiki-list"),
    path("wiki/<uuid:pk>", WikiPageDetailView.as_view(), name="wiki-detail"),
    path("wiki/<uuid:pk>/history", WikiPageHistoryView.as_view(), name="wiki-history"),
    path("wiki/<uuid:pk>/link-ticket", TicketPageLinkView.as_view(), name="wiki-link-ticket"),
    path("projects/<uuid:project_id>/analytics/kb", KBAnalyticsView.as_view(), name="analytics-kb"),
]
