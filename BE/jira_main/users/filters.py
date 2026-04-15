import django_filters
from django.db.models import Q

from users.models import User


class UserFilter(django_filters.FilterSet):
    """
    Supported query params:
      ?role=admin|pm|developer|viewer
      ?email=partial            (case-insensitive contains)
      ?search=john              (matches first_name, last_name, or email)
    """

    role   = django_filters.ChoiceFilter(choices=User.ROLE_CHOICES)
    email  = django_filters.CharFilter(lookup_expr="icontains")
    search = django_filters.CharFilter(method="filter_search")

    class Meta:
        model  = User
        fields = ["role", "email"]

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(first_name__icontains=value)
            | Q(last_name__icontains=value)
            | Q(email__icontains=value)
        )
