from django.urls import path

from projects.views import ProjectDetailView, ProjectListView, SprintDetailView, SprintListView

urlpatterns = [
    path("projects", ProjectListView.as_view(), name="project-list"),
    path("projects/<int:pk>", ProjectDetailView.as_view(), name="project-detail"),
    path("projects/<int:project_id>/sprints", SprintListView.as_view(), name="sprint-list"),
    path("sprints/<int:pk>", SprintDetailView.as_view(), name="sprint-detail"),
]
