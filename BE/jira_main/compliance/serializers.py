from rest_framework import serializers

from .models import ComplianceCheck, ComplianceTemplate


class ComplianceTemplateSerializer(serializers.ModelSerializer):
    projectId = serializers.PrimaryKeyRelatedField(source="project", read_only=True)

    class Meta:
        model = ComplianceTemplate
        fields = [
            "id",
            "projectId",
            "name",
            "description",
            "applies_to",
            "blocks_on",
            "required_role",
            "is_active",
            "order",
            "created_at",
        ]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["appliesTo"]    = rep.pop("applies_to")
        rep["blocksOn"]     = rep.pop("blocks_on")
        rep["requiredRole"] = rep.pop("required_role")
        rep["isActive"]     = rep.pop("is_active")
        rep["createdAt"]    = rep.pop("created_at")
        return rep


class ComplianceTemplateWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplianceTemplate
        fields = ["name", "description", "applies_to", "blocks_on", "required_role", "is_active", "order"]

    def validate_blocks_on(self, value):
        if not value:
            return value
        valid = {"todo", "in_progress", "review", "done"}
        parts = [s.strip() for s in value.split(",") if s.strip()]
        bad = [p for p in parts if p not in valid]
        if bad:
            raise serializers.ValidationError(f"Invalid status(es): {', '.join(bad)}. Choose from {', '.join(valid)}.")
        return ",".join(parts)


class ComplianceCheckSerializer(serializers.ModelSerializer):
    templateId   = serializers.PrimaryKeyRelatedField(source="template", read_only=True)
    templateName = serializers.CharField(source="template.name", read_only=True)
    description  = serializers.CharField(source="template.description", read_only=True)
    appliesTo    = serializers.CharField(source="template.applies_to", read_only=True)
    blocksOn     = serializers.CharField(source="template.blocks_on", read_only=True)
    requiredRole = serializers.CharField(source="template.required_role", read_only=True)
    completedBy  = serializers.SerializerMethodField()

    class Meta:
        model = ComplianceCheck
        fields = [
            "id",
            "templateId",
            "templateName",
            "description",
            "appliesTo",
            "blocksOn",
            "requiredRole",
            "status",
            "note",
            "completedBy",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    def get_completedBy(self, obj):
        if not obj.completed_by:
            return None
        u = obj.completed_by
        return {
            "id": str(u.id),
            "name": f"{u.first_name} {u.last_name}".strip() or u.email,
        }

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["completedAt"] = rep.pop("completed_at")
        rep["createdAt"]   = rep.pop("created_at")
        rep["updatedAt"]   = rep.pop("updated_at")
        return rep


class ComplianceCheckUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[("pending", "Pending"), ("complete", "Complete"), ("blocked", "Blocked"), ("not_required", "Not Required")]
    )
    note = serializers.CharField(required=False, allow_blank=True, default="")
