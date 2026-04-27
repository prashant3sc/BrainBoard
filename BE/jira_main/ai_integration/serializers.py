from rest_framework import serializers


class ChatHistoryItemSerializer(serializers.Serializer):
    role    = serializers.ChoiceField(choices=["user", "assistant"])
    content = serializers.CharField(allow_blank=True)


class ChatbotQuerySerializer(serializers.Serializer):
    query      = serializers.CharField()
    project_id = serializers.UUIDField(required=False, allow_null=True)
    sprint_id  = serializers.UUIDField(required=False, allow_null=True)
    page       = serializers.ChoiceField(
        choices=["kanban", "backlog", "wiki", "analytics", "dashboard"],
        required=False,
        allow_blank=True,
        default="",
    )
    history    = serializers.ListField(
        child=ChatHistoryItemSerializer(),
        required=False,
        default=list,
    )

    def validate_history(self, value):
        """Cap conversation history at 4 turns."""
        return value[:4]
