from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import User
from users.permissions import IsOrgAdmin
from users.serializers import (
    LoginSerializer,
    PasswordChangeSerializer,
    UserCreateSerializer,
    UserRoleUpdateSerializer,
    UserSerializer,
)


class LoginView(APIView):
    """POST /auth/login — returns user + JWT token."""

    permission_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        user = serializer.validated_data["user"]
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "user": UserSerializer(user).data,
                "token": str(refresh.access_token),
            }
        )


class LogoutView(APIView):
    """POST /auth/logout — client-side logout confirmation."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Token invalidation is handled client-side (delete the token).
        # 8-hour expiry enforces hard session limit server-side.
        return Response({"detail": "Logged out successfully"}, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    """
    GET   /auth/me — view own profile
    PATCH /auth/me — change own password only
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def patch(self, request):
        serializer = PasswordChangeSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response({"detail": "Password updated successfully"}, status=status.HTTP_200_OK)


class UserListView(APIView):
    """GET /users — list all users (all authenticated roles)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.all().order_by("first_name", "last_name")
        return Response(UserSerializer(users, many=True).data)


class UserCreateView(APIView):
    """POST /users/create — create a user (admin only)."""

    permission_classes = [IsOrgAdmin]

    def post(self, request):
        serializer = UserCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    """
    GET   /users/:id — retrieve user (admin only)
    PATCH /users/:id — update role (admin only)
    """

    permission_classes = [IsOrgAdmin]

    def _get_user(self, pk):
        try:
            return User.objects.get(pk=pk)
        except User.DoesNotExist:
            return None

    def get(self, request, pk):
        user = self._get_user(pk)
        if not user:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(UserSerializer(user).data)

    def patch(self, request, pk):
        user = self._get_user(pk)
        if not user:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = UserRoleUpdateSerializer(user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(UserSerializer(user).data)
