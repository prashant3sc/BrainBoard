from rest_framework import serializers

from wiki.models import TicketPageLink, WikiPage, WikiPageVersion, WikiSpace


class WikiSpaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = WikiSpace
        fields = ["id", "name", "description", "project", "created_at"]


class WikiPageSerializer(serializers.ModelSerializer):
    parentId = serializers.PrimaryKeyRelatedField(source="parent", read_only=True)
    projectId = serializers.PrimaryKeyRelatedField(source="project", read_only=True)

    class Meta:
        model = WikiPage
        fields = ["id", "title", "content", "parentId", "projectId", "updated_at", "created_at"]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep["updatedAt"] = rep.pop("updated_at")
        return rep


class WikiPageCreateSerializer(serializers.ModelSerializer):
    parentId = serializers.UUIDField(required=False, allow_null=True, write_only=True)
    projectId = serializers.UUIDField(write_only=True)

    class Meta:
        model = WikiPage
        fields = ["title", "content", "parentId", "projectId"]

    def create(self, validated_data):
        from projects.models import Project

        project_id = validated_data.pop("projectId")
        parent_id = validated_data.pop("parentId", None)
        request = self.context.get("request")

        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            raise serializers.ValidationError({"projectId": "Project not found"})

        parent = None
        if parent_id:
            try:
                parent = WikiPage.objects.get(pk=parent_id)
            except WikiPage.DoesNotExist:
                pass

        page = WikiPage.objects.create(
            project=project,
            parent=parent,
            created_by=request.user if request else None,
            updated_by=request.user if request else None,
            **validated_data,
        )
        # Save version 1
        WikiPageVersion.objects.create(
            page=page,
            title=page.title,
            content=page.content,
            version_number=1,
            created_by=request.user if request else None,
        )
        return page


class WikiPageUpdateSerializer(serializers.ModelSerializer):
    parentId = serializers.UUIDField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = WikiPage
        fields = ["title", "content", "parentId"]

    def update(self, instance, validated_data):
        request = self.context.get("request")
        parent_id = validated_data.pop("parentId", None)

        if parent_id is not None:
            try:
                instance.parent = WikiPage.objects.get(pk=parent_id)
            except WikiPage.DoesNotExist:
                instance.parent = None

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.updated_by = request.user if request else None
        instance.save()

        # Save a new version snapshot
        last_version = instance.versions.order_by("-version_number").first()
        next_version = (last_version.version_number + 1) if last_version else 1
        WikiPageVersion.objects.create(
            page=instance,
            title=instance.title,
            content=instance.content,
            version_number=next_version,
            created_by=request.user if request else None,
        )
        return instance


class WikiPageVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WikiPageVersion
        fields = ["id", "version_number", "title", "content", "created_by", "created_at"]


class TicketPageLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketPageLink
        fields = ["id", "issue", "wiki_page", "created_at"]
