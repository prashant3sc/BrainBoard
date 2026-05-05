from django.contrib import admin
from .models import WorkflowTemplate


@admin.register(WorkflowTemplate)
class WorkflowTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "template_type", "project", "category", "is_active", "is_system", "order"]
    list_filter  = ["template_type", "is_active", "is_system", "category"]
    search_fields = ["name", "description"]
