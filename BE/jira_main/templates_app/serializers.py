from rest_framework import serializers
from .models import WorkflowTemplate


class WorkflowTemplateSerializer(serializers.ModelSerializer):
    projectId = serializers.PrimaryKeyRelatedField(source="project", read_only=True)

    class Meta:
        model = WorkflowTemplate
        fields = [
            "id", "projectId", "template_type", "name", "description",
            "icon", "category", "is_active", "is_system", "config",
            "order", "created_at", "updated_at",
        ]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["templateType"] = rep.pop("template_type")
        rep["isActive"]     = rep.pop("is_active")
        rep["isSystem"]     = rep.pop("is_system")
        rep["createdAt"]    = rep.pop("created_at")
        rep["updatedAt"]    = rep.pop("updated_at")
        return rep


class WorkflowTemplateWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkflowTemplate
        fields = ["name", "description", "icon", "category", "template_type", "is_active", "config", "order"]

    def validate_template_type(self, value):
        allowed = {WorkflowTemplate.PROJECT, WorkflowTemplate.ISSUE, WorkflowTemplate.WIKI}
        if value not in allowed:
            raise serializers.ValidationError(f"template_type must be one of: {', '.join(allowed)}")
        return value
