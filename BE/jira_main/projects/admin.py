from django.contrib import admin

from projects.models import Project, ProjectMember, Sprint


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["name", "owner", "is_archived", "created_at"]
    list_filter = ["is_archived"]
    search_fields = ["name"]


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display = ["project", "user", "joined_at"]


@admin.register(Sprint)
class SprintAdmin(admin.ModelAdmin):
    list_display = ["name", "project", "status", "start_date", "end_date"]
    list_filter = ["status", "project"]
