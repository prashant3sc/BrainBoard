from django.urls import path

from users.views import LoginView, UserDetailView, UserListView

urlpatterns = [
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("users", UserListView.as_view(), name="user-list"),
    path("users/<uuid:pk>", UserDetailView.as_view(), name="user-detail"),
]
