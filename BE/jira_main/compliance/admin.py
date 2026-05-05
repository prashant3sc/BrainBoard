from django.contrib import admin
from .models import ComplianceCheck, ComplianceTemplate


@admin.register(ComplianceTemplate)
class ComplianceTemplateAdmin(admin.ModelAdmin):
    list_display = ["name", "project", "applies_to", "blocks_on", "required_role", "is_active", "order"]
    list_filter = ["project", "is_active", "applies_to"]


@admin.register(ComplianceCheck)
class ComplianceCheckAdmin(admin.ModelAdmin):
    list_display = ["issue", "template", "status", "completed_by", "completed_at"]
    list_filter = ["status", "template__project"]
