import django_filters

from issues.models import Issue


class IssueFilter(django_filters.FilterSet):
    """
    Supported query params:
      ?status=todo|in_progress|review|done
      ?priority=critical|high|medium|low
      ?assignee_id=<uuid>        filter by assignee UUID
      ?sprint_id=<uuid>          filter by sprint UUID
      ?backlog=true              only unassigned-to-sprint tickets (sprint=null)
      ?label_id=<uuid>           filter by label UUID (M2M)
      ?search=text               case-insensitive title/description search
      ?issue_type=task|subtask|bug
      ?due_date_before=YYYY-MM-DD    issues due on or before this date
      ?due_date_after=YYYY-MM-DD     issues due on or after this date
    """

    status          = django_filters.ChoiceFilter(choices=Issue.STATUS_CHOICES)
    priority        = django_filters.ChoiceFilter(choices=Issue.PRIORITY_CHOICES)
    issue_type      = django_filters.ChoiceFilter(choices=Issue.ISSUE_TYPE_CHOICES)
    assignee_id     = django_filters.UUIDFilter(field_name="assignee__id")
    sprint_id       = django_filters.UUIDFilter(field_name="sprint__id")
    backlog         = django_filters.BooleanFilter(field_name="sprint", lookup_expr="isnull")
    label_id        = django_filters.UUIDFilter(field_name="labels__id")
    due_date_before = django_filters.DateFilter(field_name="due_date", lookup_expr="lte")
    due_date_after  = django_filters.DateFilter(field_name="due_date", lookup_expr="gte")
    search          = django_filters.CharFilter(method="filter_search")

    class Meta:
        model  = Issue
        fields = ["status", "priority", "issue_type", "assignee_id", "sprint_id", "backlog", "label_id"]

    def filter_search(self, queryset, name, value):
        from django.db.models import Q
        return queryset.filter(
            Q(title__icontains=value) | Q(description__icontains=value)
        )
