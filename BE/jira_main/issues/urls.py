from django.urls import path

from issues.views import IssueDetailView, IssueListView, LabelListView, ProjectIssueListView

urlpatterns = [
    path("projects/<uuid:project_id>/issues", ProjectIssueListView.as_view(), name="project-issue-list"),
    path("issues", IssueListView.as_view(), name="issue-list"),
    path("issues/<uuid:pk>", IssueDetailView.as_view(), name="issue-detail"),
    path("projects/<uuid:project_id>/labels", LabelListView.as_view(), name="label-list"),
]
