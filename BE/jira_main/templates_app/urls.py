from django.urls import path
from . import views

urlpatterns = [
    path("templates",                                    views.TemplateListView.as_view()),
    path("templates/<uuid:pk>",                          views.TemplateDetailView.as_view()),
    path("projects/<uuid:project_id>/templates",         views.ProjectTemplateListView.as_view()),
    path("projects/<uuid:project_id>/apply-template",    views.ApplyProjectTemplateView.as_view()),
]
