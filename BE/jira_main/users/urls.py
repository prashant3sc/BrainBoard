from django.urls import path

from users.views import (
    LoginView,
    LogoutView,
    UserCreateView,
    UserDetailView,
    UserListView,
    UserProfileView,
)

urlpatterns = [
    # Auth
    path("auth/login", LoginView.as_view(), name="auth-login"),
    path("auth/logout", LogoutView.as_view(), name="auth-logout"),
    path("auth/me", UserProfileView.as_view(), name="auth-me"),
    # Users (admin management)
    path("users", UserListView.as_view(), name="user-list"),
    path("users/create", UserCreateView.as_view(), name="user-create"),
    path("users/<uuid:pk>", UserDetailView.as_view(), name="user-detail"),
]
