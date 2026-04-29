from django.urls import path

from issues.views import (
    CommentDetailView,
    IssueCommentListView,
    IssueDetailView,
    IssueListView,
    LabelDetailView,
    LabelListView,
    ProjectIssueListView,
)

urlpatterns = [
    path("projects/<uuid:project_id>/issues", ProjectIssueListView.as_view(), name="project-issue-list"),
    path("issues", IssueListView.as_view(), name="issue-list"),
    # UUID lookup (internal)
    path("issues/<uuid:pk>", IssueDetailView.as_view(), name="issue-detail"),
    # Ticket-key lookup: e.g. BB-12, SHOP-3
    path("issues/<str:ticket_id>", IssueDetailView.as_view(), name="issue-detail-by-key"),
    # Comments
    path("issues/<uuid:pk>/comments", IssueCommentListView.as_view(), name="issue-comments"),
    path("comments/<uuid:pk>", CommentDetailView.as_view(), name="comment-detail"),
    # Labels
    path("projects/<uuid:project_id>/labels", LabelListView.as_view(), name="label-list"),
    path("projects/<uuid:project_id>/labels/<uuid:label_id>", LabelDetailView.as_view(), name="label-detail"),
]
