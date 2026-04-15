from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("users.urls")),
    path("", include("projects.urls")),
    path("", include("issues.urls")),
    path("", include("wiki.urls")),
    path("", include("search.urls")),
]
