from django.urls import path

from search.views import SearchView, SemanticSearchView

urlpatterns = [
    path("search", SearchView.as_view(), name="search"),
    path("search/semantic", SemanticSearchView.as_view(), name="search-semantic"),
]
