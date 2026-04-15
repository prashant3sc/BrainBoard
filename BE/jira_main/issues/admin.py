from django.contrib import admin

from issues.models import Issue, Label


@admin.register(Issue)
class IssueAdmin(admin.ModelAdmin):
    list_display = ["title", "project", "status", "priority", "assignee", "created_at"]
    list_filter = ["status", "priority", "project"]
    search_fields = ["title", "description"]


@admin.register(Label)
class LabelAdmin(admin.ModelAdmin):
    list_display = ["name", "project", "color"]
