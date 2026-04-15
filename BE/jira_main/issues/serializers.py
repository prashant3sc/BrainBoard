from rest_framework import serializers

from issues.models import Issue, Label


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ["id", "name", "color", "project"]


class IssueSerializer(serializers.ModelSerializer):
    assigneeId = serializers.PrimaryKeyRelatedField(source="assignee", read_only=True)
    projectId = serializers.PrimaryKeyRelatedField(source="project", read_only=True)
    labelIds = serializers.PrimaryKeyRelatedField(source="labels", many=True, read_only=True)

    class Meta:
        model = Issue
        fields = [
            "id",
            "title",
            "description",
            "status",
            "priority",
            "story_points",
            "assigneeId",
            "projectId",
            "labelIds",
            "created_at",
            "updated_at",
        ]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["storyPoints"] = rep.pop("story_points")
        rep["createdAt"] = rep.pop("created_at")
        rep["updatedAt"] = rep.pop("updated_at")
        return rep


class IssueCreateSerializer(serializers.ModelSerializer):
    assigneeId = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    projectId = serializers.IntegerField(write_only=True)
    storyPoints = serializers.IntegerField(
        required=False, allow_null=True, write_only=True, source="story_points"
    )

    class Meta:
        model = Issue
        fields = [
            "title",
            "description",
            "status",
            "priority",
            "storyPoints",
            "assigneeId",
            "projectId",
        ]

    def create(self, validated_data):
        from projects.models import Project
        from users.models import User

        project_id = validated_data.pop("projectId", None)
        assignee_id = validated_data.pop("assigneeId", None)
        request = self.context.get("request")

        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            raise serializers.ValidationError({"projectId": "Project not found"})

        assignee = None
        if assignee_id:
            try:
                assignee = User.objects.get(pk=assignee_id)
            except User.DoesNotExist:
                pass

        return Issue.objects.create(
            project=project,
            assignee=assignee,
            reporter=request.user if request else None,
            **validated_data,
        )


class IssueUpdateSerializer(serializers.ModelSerializer):
    assigneeId = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    storyPoints = serializers.IntegerField(
        required=False, allow_null=True, write_only=True, source="story_points"
    )

    class Meta:
        model = Issue
        fields = ["title", "description", "status", "priority", "storyPoints", "assigneeId"]

    def update(self, instance, validated_data):
        from users.models import User

        assignee_id = validated_data.pop("assigneeId", None)
        if assignee_id is not None:
            try:
                instance.assignee = User.objects.get(pk=assignee_id)
            except User.DoesNotExist:
                instance.assignee = None
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        return instance
