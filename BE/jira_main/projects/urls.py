from django.urls import path

from projects.views import (
    ActiveSprintView,
    ProjectCreateView,
    ProjectDetailView,
    ProjectListView,
    ProjectMemberAddView,
    ProjectMemberDeleteView,
    ProjectMemberListView,
    SprintDetailView,
    SprintListView,
    VelocityView,
    WorkloadView,
)

urlpatterns = [
    # Projects
    path("projects", ProjectListView.as_view(), name="project-list"),
    path("projects/create", ProjectCreateView.as_view(), name="project-create"),
    path("projects/<uuid:pk>", ProjectDetailView.as_view(), name="project-detail"),
    # Members
    path("projects/<uuid:project_id>/members", ProjectMemberListView.as_view(), name="project-member-list"),
    path("projects/<uuid:project_id>/members/add", ProjectMemberAddView.as_view(), name="project-member-add"),
    path("projects/<uuid:project_id>/members/<uuid:user_id>", ProjectMemberDeleteView.as_view(), name="project-member-delete"),
    # Sprints
    path("projects/<uuid:project_id>/sprints", SprintListView.as_view(), name="sprint-list"),
    path("projects/<uuid:project_id>/active-sprint", ActiveSprintView.as_view(), name="active-sprint"),
    path("sprints/<uuid:pk>", SprintDetailView.as_view(), name="sprint-detail"),
    # Analytics
    path("projects/<uuid:project_id>/analytics/velocity", VelocityView.as_view(), name="analytics-velocity"),
    path("projects/<uuid:project_id>/analytics/workload", WorkloadView.as_view(), name="analytics-workload"),
]
