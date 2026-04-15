import uuid

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        extra_fields.setdefault("username", email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", "admin")
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    ADMIN = "admin"
    PM = "pm"
    DEVELOPER = "developer"
    VIEWER = "viewer"

    ROLE_CHOICES = [
        (ADMIN, "Admin"),
        (PM, "Project Manager"),
        (DEVELOPER, "Developer"),
        (VIEWER, "Viewer"),
    ]

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=VIEWER)
    avatar_url = models.URLField(null=True, blank=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        db_table = "users"

    def __str__(self):
        return f"{self.get_full_name()} <{self.email}>"

    # convenience properties used by permission classes
    @property
    def is_org_admin(self):
        return self.role == self.ADMIN

    @property
    def can_manage_projects(self):
        return self.role in (self.ADMIN, self.PM)

    @property
    def can_create_issues(self):
        return self.role in (self.ADMIN, self.PM, self.DEVELOPER)

    @property
    def can_write_wiki(self):
        return self.role in (self.ADMIN, self.PM, self.DEVELOPER)

    @property
    def can_plan_sprints(self):
        return self.role in (self.ADMIN, self.PM)
