import django_filters

from projects.models import Project, Sprint


class ProjectFilter(django_filters.FilterSet):
    """
    Supported query params:
      ?is_archived=true|false   (default view already hides archived; use true to see them)
      ?search=name              (case-insensitive name/description search)
    """

    is_archived = django_filters.BooleanFilter()
    search      = django_filters.CharFilter(method="filter_search")

    class Meta:
        model  = Project
        fields = ["is_archived"]

    def filter_search(self, queryset, name, value):
        from django.db.models import Q
        return queryset.filter(
            Q(name__icontains=value) | Q(description__icontains=value)
        )


class SprintFilter(django_filters.FilterSet):
    """
    Supported query params:
      ?status=planned|active|completed
    """

    status = django_filters.ChoiceFilter(choices=Sprint.STATUS_CHOICES)

    class Meta:
        model  = Sprint
        fields = ["status"]
