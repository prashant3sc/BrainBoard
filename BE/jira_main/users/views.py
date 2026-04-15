from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from users.models import User
from users.serializers import (
    LoginSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserSerializer,
    UserUpdateSerializer,
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


class UserListView(APIView):
    """
    GET  /users — list all users
    POST /users — create a user (admin only)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = User.objects.all().order_by("first_name", "last_name")
        serializer = UserListSerializer(users, many=True)
        return Response(serializer.data)

    def post(self, request):
        if not request.user.is_org_admin:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        serializer = UserCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class UserDetailView(APIView):
    """
    GET   /users/:id — retrieve user
    PATCH /users/:id — update (admin for role; self for profile)
    """

    permission_classes = [IsAuthenticated]

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

        if "role" in request.data and not request.user.is_org_admin:
            return Response(
                {"detail": "Only admins can change roles"},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not request.user.is_org_admin and request.user.pk != user.pk:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserUpdateSerializer(user, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(UserSerializer(user).data)
