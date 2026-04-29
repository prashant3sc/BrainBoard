from rest_framework import serializers

from projects.models import Project, ProjectMember, Sprint
from users.serializers import UserSerializer


class ProjectSerializer(serializers.ModelSerializer):
    ownerId   = serializers.PrimaryKeyRelatedField(source="owner", read_only=True)
    memberIds = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "name", "description", "key", "ownerId", "memberIds", "is_archived", "created_at"]

    def get_memberIds(self, instance):
        return list(
            ProjectMember.objects.filter(project=instance).values_list("user_id", flat=True)
        )

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["isArchived"] = rep.pop("is_archived")
        rep["createdAt"]  = rep.pop("created_at")
        rep["memberIds"]  = [str(uid) for uid in rep["memberIds"]]
        return rep


class ProjectCreateSerializer(serializers.ModelSerializer):
    ownerId = serializers.UUIDField(write_only=True, required=False)
    key = serializers.RegexField(
        r'^[A-Z0-9]{1,6}$',
        required=True,
        error_messages={
            "invalid": "Key must be 1–6 uppercase letters or digits (e.g. BB, SHOP).",
        },
    )

    class Meta:
        model = Project
        fields = ["name", "description", "key", "ownerId"]

    def validate_key(self, value):
        value = value.upper()
        if Project.objects.filter(key=value).exists():
            raise serializers.ValidationError(f"'{value}' is already taken. Choose a different key.")
        return value

    def create(self, validated_data):
        from users.models import User
        from issues.models import Label

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
        project = Project.objects.create(owner=owner, **validated_data)

        # Seed the 4 default labels for every new project
        DEFAULT_LABELS = [
            {"name": "Frontend",     "color": "#0052CC"},
            {"name": "Backend",      "color": "#00875A"},
            {"name": "Data Science", "color": "#6554C0"},
            {"name": "QA Testing",   "color": "#FF8B00"},
        ]
        for label in DEFAULT_LABELS:
            Label.objects.create(project=project, **label)

        return project


class ProjectUpdateSerializer(serializers.ModelSerializer):
    """Admin/PM: update project name, description, and archived state."""

    is_archived = serializers.BooleanField(required=False)

    class Meta:
        model = Project
        fields = ["name", "description", "is_archived"]

    def update(self, instance, validated_data):
        if "is_archived" in validated_data:
            instance.is_archived = validated_data.pop("is_archived")
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


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
    startDate = serializers.DateField(source="start_date", required=False, allow_null=True)
    endDate = serializers.DateField(source="end_date", required=False, allow_null=True)

    class Meta:
        model = Sprint
        fields = [
            "id",
            "name",
            "goal",
            "status",
            "startDate",
            "endDate",
            "project",
            "created_at",
        ]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["createdAt"] = rep.pop("created_at")
        return rep
