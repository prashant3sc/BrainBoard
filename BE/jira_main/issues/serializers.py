from rest_framework import serializers

from issues.models import Comment, Issue, Label


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ["id", "name", "color", "project"]


class IssueSerializer(serializers.ModelSerializer):
    assigneeId   = serializers.PrimaryKeyRelatedField(source="assignee", read_only=True)
    reporterId   = serializers.PrimaryKeyRelatedField(source="reporter", read_only=True)
    projectId    = serializers.PrimaryKeyRelatedField(source="project", read_only=True)
    sprintId     = serializers.PrimaryKeyRelatedField(source="sprint", read_only=True)
    parentId     = serializers.PrimaryKeyRelatedField(source="parent", read_only=True)
    labelIds     = serializers.PrimaryKeyRelatedField(source="labels", many=True, read_only=True)
    subtaskCount  = serializers.SerializerMethodField()
    commentCount  = serializers.SerializerMethodField()
    wikiLinked    = serializers.SerializerMethodField()
    progress      = serializers.SerializerMethodField()
    ticketId      = serializers.SerializerMethodField()

    class Meta:
        model = Issue
        fields = [
            "id",
            "ticketId",
            "title",
            "description",
            "status",
            "priority",
            "issue_type",
            "story_points",
            "due_date",
            "sequence_number",
            "assigneeId",
            "reporterId",
            "projectId",
            "sprintId",
            "parentId",
            "labelIds",
            "subtaskCount",
            "commentCount",
            "wikiLinked",
            "progress",
            "created_at",
            "updated_at",
        ]

    def get_ticketId(self, instance):
        return instance.ticket_id

    def get_subtaskCount(self, instance):
        if hasattr(instance, "subtask_count"):
            return instance.subtask_count
        return instance.subtasks.count()

    def get_commentCount(self, instance):
        if hasattr(instance, "comment_count"):
            return instance.comment_count
        return instance.comments.count()

    def get_wikiLinked(self, instance):
        if hasattr(instance, "wiki_link_count"):
            return instance.wiki_link_count > 0
        return instance.wiki_links.exists()

    def get_progress(self, instance):
        if hasattr(instance, "subtask_count"):
            total = instance.subtask_count
            if total == 0:
                return 0
            done = instance.done_subtask_count if hasattr(instance, "done_subtask_count") else instance.subtasks.filter(status=Issue.DONE).count()
        else:
            total = instance.subtasks.count()
            if total == 0:
                return 0
            done = instance.subtasks.filter(status=Issue.DONE).count()
        return round((done / total) * 100)

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["storyPoints"]    = rep.pop("story_points")
        rep["issueType"]      = rep.pop("issue_type")
        rep["dueDate"]        = rep.pop("due_date")
        rep["sequenceNumber"] = rep.pop("sequence_number")
        rep["createdAt"]      = rep.pop("created_at")
        rep["updatedAt"]      = rep.pop("updated_at")
        return rep


class IssueCreateSerializer(serializers.ModelSerializer):
    assigneeId  = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    projectId   = serializers.UUIDField(write_only=True)
    parentId    = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    sprintId    = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    labelIds    = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    storyPoints = serializers.IntegerField(
        required=False, allow_null=True, write_only=True, source="story_points"
    )
    issueType = serializers.ChoiceField(
        choices=Issue.ISSUE_TYPE_CHOICES, required=False, write_only=True, source="issue_type"
    )
    dueDate = serializers.DateField(required=False, allow_null=True, write_only=True, source="due_date")

    class Meta:
        model = Issue
        fields = [
            "title",
            "description",
            "priority",
            "issueType",
            "storyPoints",
            "dueDate",
            "assigneeId",
            "projectId",
            "parentId",
            "sprintId",
            "labelIds",
        ]

    def validate(self, attrs):
        issue_type = attrs.get("issue_type", Issue.TASK)
        if issue_type == Issue.SUBTASK and not attrs.get("parentId"):
            raise serializers.ValidationError({"parentId": "parentId is required when issueType is subtask."})
        return attrs

    def create(self, validated_data):
        from django.db import transaction
        from django.db.models import Max
        from projects.models import Project, Sprint
        from users.models import User

        project_id  = validated_data.pop("projectId", None)
        assignee_id = validated_data.pop("assigneeId", None)
        parent_id   = validated_data.pop("parentId", None)
        sprint_id   = validated_data.pop("sprintId", None)
        label_ids   = validated_data.pop("labelIds", [])
        request     = self.context.get("request")

        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            raise serializers.ValidationError({"projectId": "Project not found"})

        sprint = None
        if sprint_id is not None:
            try:
                sprint = Sprint.objects.get(pk=sprint_id, project=project)
            except Sprint.DoesNotExist:
                raise serializers.ValidationError({"sprintId": "Sprint not found or does not belong to this project"})

        assignee = None
        if assignee_id:
            try:
                assignee = User.objects.get(pk=assignee_id)
            except User.DoesNotExist:
                pass

        parent = None
        if parent_id:
            try:
                parent = Issue.objects.get(pk=parent_id)
            except Issue.DoesNotExist:
                raise serializers.ValidationError({"parentId": "Parent issue not found."})
            if parent.issue_type != Issue.TASK:
                raise serializers.ValidationError({"parentId": "Only tasks can be parent issues. Bugs and subtasks cannot have children."})

        with transaction.atomic():
            # Lock all issues for this project to prevent race conditions on sequence_number
            max_seq = (
                Issue.objects
                .select_for_update()
                .filter(project=project)
                .aggregate(Max("sequence_number"))["sequence_number__max"]
            ) or 0
            sequence_number = max_seq + 1

            issue = Issue.objects.create(
                project=project,
                sprint=sprint,
                status=Issue.TODO,
                assignee=assignee,
                reporter=request.user if request else None,
                parent=parent,
                sequence_number=sequence_number,
                **validated_data,
            )

        if label_ids:
            issue.labels.set(Label.objects.filter(pk__in=label_ids, project=project))
        return issue


class IssueUpdateSerializer(serializers.ModelSerializer):
    assigneeId  = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    sprintId    = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    parentId    = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    labelIds    = serializers.ListField(child=serializers.UUIDField(), required=False, write_only=True)
    storyPoints = serializers.IntegerField(
        required=False, allow_null=True, write_only=True, source="story_points"
    )
    issueType = serializers.ChoiceField(
        choices=Issue.ISSUE_TYPE_CHOICES, required=False, write_only=True, source="issue_type"
    )
    dueDate = serializers.DateField(required=False, allow_null=True, write_only=True, source="due_date")

    class Meta:
        model = Issue
        fields = ["title", "description", "status", "priority", "issueType", "storyPoints", "dueDate", "assigneeId", "sprintId", "parentId", "labelIds"]

    def update(self, instance, validated_data):
        from projects.models import Sprint
        from users.models import User

        # Block moving to done if any subtasks are still incomplete
        new_status = validated_data.get("status")
        if new_status == Issue.DONE and instance.issue_type != Issue.SUBTASK:
            incomplete = instance.subtasks.exclude(status=Issue.DONE).count()
            if incomplete:
                raise serializers.ValidationError({
                    "status": f"Cannot mark as Done — {incomplete} subtask{'s' if incomplete > 1 else ''} still open."
                })

        # Handle assignee change — distinguish "not sent" from "sent as null"
        if "assigneeId" in validated_data:
            assignee_id = validated_data.pop("assigneeId")
            if assignee_id is None:
                instance.assignee = None
            else:
                try:
                    instance.assignee = User.objects.get(pk=assignee_id)
                except User.DoesNotExist:
                    pass

        # Handle sprint change — null means move to backlog
        if "sprintId" in validated_data:
            sprint_id = validated_data.pop("sprintId")
            if sprint_id is None:
                instance.sprint = None
            else:
                try:
                    instance.sprint = Sprint.objects.get(pk=sprint_id)
                except Sprint.DoesNotExist:
                    pass

        # Handle parent change — null means detach from parent
        if "parentId" in validated_data:
            parent_id = validated_data.pop("parentId")
            if parent_id is None:
                instance.parent = None
            else:
                try:
                    parent = Issue.objects.get(pk=parent_id)
                    if parent.issue_type != Issue.TASK:
                        raise serializers.ValidationError({"parentId": "Only tasks can be parent issues."})
                    instance.parent = parent
                except Issue.DoesNotExist:
                    pass

        # Handle label change — replaces the full set
        if "labelIds" in validated_data:
            label_ids = validated_data.pop("labelIds")
            instance.labels.set(Label.objects.filter(pk__in=label_ids, project=instance.project))

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        return instance


# ─────────────────────────────────────────────────────────────────────────────
# Comments
# ─────────────────────────────────────────────────────────────────────────────

class CommentAuthorSerializer(serializers.Serializer):
    """Lightweight author embed — id, full name, avatar initial."""
    id        = serializers.UUIDField()
    firstName = serializers.SerializerMethodField()
    lastName  = serializers.SerializerMethodField()
    fullName  = serializers.SerializerMethodField()
    avatar    = serializers.SerializerMethodField()

    def get_firstName(self, obj):
        return obj.first_name

    def get_lastName(self, obj):
        return obj.last_name

    def get_fullName(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email

    def get_avatar(self, obj):
        # Returns first letter of name for avatar fallback
        name = f"{obj.first_name} {obj.last_name}".strip() or obj.email
        return name[0].upper() if name else "?"


class ReplySerializer(serializers.ModelSerializer):
    author   = CommentAuthorSerializer(read_only=True)
    isEdited = serializers.SerializerMethodField()
    parentId = serializers.UUIDField(source="parent_id", read_only=True)

    class Meta:
        model  = Comment
        fields = ["id", "parentId", "author", "body", "isEdited", "created_at", "updated_at"]

    def get_isEdited(self, obj):
        return obj.is_edited

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["createdAt"] = rep.pop("created_at")
        rep["updatedAt"] = rep.pop("updated_at")
        return rep


class CommentSerializer(serializers.ModelSerializer):
    author   = CommentAuthorSerializer(read_only=True)
    replies  = ReplySerializer(many=True, read_only=True)
    isEdited = serializers.SerializerMethodField()

    class Meta:
        model  = Comment
        fields = ["id", "author", "body", "isEdited", "replies", "created_at", "updated_at"]

    def get_isEdited(self, obj):
        return obj.is_edited

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["createdAt"] = rep.pop("created_at")
        rep["updatedAt"] = rep.pop("updated_at")
        return rep


class CommentCreateSerializer(serializers.Serializer):
    body     = serializers.CharField(min_length=1)
    parentId = serializers.UUIDField(required=False, allow_null=True)

    def validate_parentId(self, value):
        if value is None:
            return value
        try:
            parent = Comment.objects.get(pk=value)
        except Comment.DoesNotExist:
            raise serializers.ValidationError("Parent comment not found.")
        if parent.parent_id is not None:
            raise serializers.ValidationError("Cannot reply to a reply — only one level of nesting allowed.")
        return value


class CommentEditSerializer(serializers.Serializer):
    body = serializers.CharField(min_length=1)
