from django.contrib.auth import authenticate
from rest_framework import serializers

from users.models import User


class UserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    avatarUrl = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "role", "avatarUrl"]

    def get_name(self, obj):
        return obj.get_full_name() or obj.email

    def get_avatarUrl(self, obj):
        return obj.avatar_url


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        user = authenticate(username=data["email"], password=data["password"])
        if not user:
            raise serializers.ValidationError("Invalid credentials")
        if not user.is_active:
            raise serializers.ValidationError("Account is disabled")
        data["user"] = user
        return data


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ["id", "first_name", "last_name", "email", "role", "password"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data["username"] = validated_data["email"]
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserRoleUpdateSerializer(serializers.ModelSerializer):
    """Admin-only: change a user's role."""

    class Meta:
        model = User
        fields = ["role"]


class PasswordChangeSerializer(serializers.Serializer):
    """Self-service: user changes their own password from the profile page."""

    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect")
        return value

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user
