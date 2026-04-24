from django.urls import path
from . import views

urlpatterns = [
    path("ai/health",                                       views.AIHealthView.as_view()),
    path("ai/sync",                                         views.SyncView.as_view()),
    path("ai/sync/status",                                  views.SyncStatusView.as_view()),
    path("ai/analyze-issue/<uuid:issue_id>",                views.AnalyzeIssueView.as_view()),
    path("ai/analyze-draft",                               views.AnalyzeDraftView.as_view()),
    path("ai/chat",                                         views.ChatView.as_view()),
    path("projects/<uuid:project_id>/ai-pulse",             views.SprintPulseView.as_view()),
]
