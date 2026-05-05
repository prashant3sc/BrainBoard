from django.urls import path
from . import views

urlpatterns = [
    # Template management (project settings)
    path(
        "projects/<uuid:project_id>/compliance/templates",
        views.ProjectComplianceTemplateListView.as_view(),
    ),
    path(
        "projects/<uuid:project_id>/compliance/templates/<uuid:template_id>",
        views.ProjectComplianceTemplateDetailView.as_view(),
    ),
    # Issue-level checks
    path(
        "issues/<uuid:issue_id>/compliance",
        views.IssueComplianceListView.as_view(),
    ),
    path(
        "issues/<uuid:issue_id>/compliance/<uuid:check_id>",
        views.IssueComplianceCheckDetailView.as_view(),
    ),
    # Analytics
    path(
        "projects/<uuid:project_id>/compliance/analytics",
        views.ProjectComplianceAnalyticsView.as_view(),
    ),
]
