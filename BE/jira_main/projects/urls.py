from django.urls import path

from projects.views import ProjectDetailView, ProjectListView, SprintDetailView, SprintListView

urlpatterns = [
    path("projects", ProjectListView.as_view(), name="project-list"),
    path("projects/<uuid:pk>", ProjectDetailView.as_view(), name="project-detail"),
    path("projects/<uuid:project_id>/sprints", SprintListView.as_view(), name="sprint-list"),
    path("sprints/<uuid:pk>", SprintDetailView.as_view(), name="sprint-detail"),
]
