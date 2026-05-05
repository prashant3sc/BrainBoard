from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("", include("users.urls")),
    path("", include("projects.urls")),
    path("", include("issues.urls")),
    path("", include("wiki.urls")),
    path("", include("search.urls")),
    path("", include("ai_integration.urls")),
    path("", include("compliance.urls")),
    path("", include("templates_app.urls")),
]
