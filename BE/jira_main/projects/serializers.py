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
    """Admin/PM: update project name and description only."""

    class Meta:
        model = Project
        fields = ["name", "description"]


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    userId = serializers.UUIDField(write_only=True)

    class Meta:
        model = ProjectMember
        fields = ["id", "user", "userId", "joined_at"]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["joinedAt"] = rep.pop("joined_at")
        return rep

    def create(self, validated_data):
        from users.models import User

        user_id = validated_data.pop("userId")
        project = self.context["project"]
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            raise serializers.ValidationError({"userId": "User not found"})
        if ProjectMember.objects.filter(project=project, user=user).exists():
            raise serializers.ValidationError({"userId": "User is already a member of this project"})
        return ProjectMember.objects.create(project=project, user=user)


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

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["startDate"] = rep.pop("start_date")
        rep["endDate"] = rep.pop("end_date")
        rep["createdAt"] = rep.pop("created_at")
        return rep
