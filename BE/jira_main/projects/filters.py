import django_filters

from projects.models import Project, Sprint


class ProjectFilter(django_filters.FilterSet):
    """
    Supported query params:
      ?search=name   case-insensitive name/description search
    """

    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model  = Project
        fields = []

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
