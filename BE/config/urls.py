from django.urls import path, include

urlpatterns = [
    path('api/auth/',     include('apps.users.urls')),
    path('api/users/',    include('apps.users.urls')),
    path('api/projects/', include('apps.projects.urls')),
    path('api/issues/',   include('apps.issues.urls')),
    path('api/wiki/',     include('apps.wiki.urls')),
    path('api/search/',   include('apps.search.urls')),
]
