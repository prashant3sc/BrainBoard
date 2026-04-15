from django.urls import path

from wiki.views import (
    ProjectWikiListView,
    TicketPageLinkView,
    WikiPageDetailView,
    WikiPageHistoryView,
    WikiPageListView,
)

urlpatterns = [
    path("projects/<int:project_id>/wiki", ProjectWikiListView.as_view(), name="project-wiki-list"),
    path("wiki", WikiPageListView.as_view(), name="wiki-list"),
    path("wiki/<int:pk>", WikiPageDetailView.as_view(), name="wiki-detail"),
    path("wiki/<int:pk>/history", WikiPageHistoryView.as_view(), name="wiki-history"),
    path("wiki/<int:pk>/link-ticket", TicketPageLinkView.as_view(), name="wiki-link-ticket"),
]
