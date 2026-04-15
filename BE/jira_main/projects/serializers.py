from rest_framework import serializers

from projects.models import Project, ProjectMember, Sprint
from users.serializers import UserSerializer


class ProjectSerializer(serializers.ModelSerializer):
    ownerId = serializers.PrimaryKeyRelatedField(source="owner", read_only=True)

    class Meta:
        model = Project
        fields = ["id", "name", "description", "ownerId", "created_at"]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["createdAt"] = rep.pop("created_at")
        return rep


class ProjectCreateSerializer(serializers.ModelSerializer):
    ownerId = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = Project
        fields = ["name", "description", "ownerId"]

    def create(self, validated_data):
        from users.models import User

        owner_id = validated_data.pop("ownerId", None)
        request = self.context.get("request")
        owner = None
        if owner_id:
            try:
                owner = User.objects.get(pk=owner_id)
            except User.DoesNotExist:
                pass
        if not owner and request:
            owner = request.user
        return Project.objects.create(owner=owner, **validated_data)


class ProjectUpdateSerializer(serializers.ModelSerializer):
    ownerId = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = Project
        fields = ["name", "description", "ownerId"]

    def update(self, instance, validated_data):
        from users.models import User

        owner_id = validated_data.pop("ownerId", None)
        if owner_id is not None:
            try:
                instance.owner = User.objects.get(pk=owner_id)
            except User.DoesNotExist:
                pass
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        return instance


class SprintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sprint
        fields = [
            "id",
            "name",
            "goal",
            "status",
            "start_date",
            "end_date",
            "project",
            "created_at",
        ]
