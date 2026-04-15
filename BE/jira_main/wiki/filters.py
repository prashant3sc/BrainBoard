import django_filters

from wiki.models import WikiPage


class WikiPageFilter(django_filters.FilterSet):
    """
    Supported query params:
      ?space_id=<uuid>    filter pages by wiki space
      ?parent_id=<uuid>   filter by parent page (direct children)
      ?root_only=true     only top-level pages (parent=null)
      ?search=text        case-insensitive title/content search
    """

    space_id  = django_filters.UUIDFilter(field_name="space__id")
    parent_id = django_filters.UUIDFilter(field_name="parent__id")
    root_only = django_filters.BooleanFilter(field_name="parent", lookup_expr="isnull")
    search    = django_filters.CharFilter(method="filter_search")

    class Meta:
        model  = WikiPage
        fields = ["space_id", "parent_id", "root_only"]

    def filter_search(self, queryset, name, value):
        from django.db.models import Q
        return queryset.filter(
            Q(title__icontains=value) | Q(content__icontains=value)
        )
