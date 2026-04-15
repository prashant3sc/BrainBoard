"""
RBAC permission classes for BrainBoard.

Role hierarchy:
  admin > pm > developer > viewer

Permissions matrix (see docs for full table):
  - View projects/issues/wiki/search : all roles
  - Create/update/archive projects   : admin, pm
  - Assign system roles              : admin only
  - Create/edit issues               : admin, pm, developer
  - Delete issues                    : admin, pm
  - Plan/start/close sprints         : admin, pm
  - Create/edit wiki pages           : admin, pm, developer
  - Delete wiki pages                : admin, pm
"""

from rest_framework.permissions import BasePermission, IsAuthenticated


class IsOrgAdmin(BasePermission):
    """Only org-level admins."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_org_admin)


class IsAdminOrPM(BasePermission):
    """Admin or Project Manager."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.can_manage_projects
        )


class CanCreateIssue(BasePermission):
    """Admin, PM, or Developer."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.can_create_issues
        )


class CanWriteWiki(BasePermission):
    """Admin, PM, or Developer."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.can_write_wiki
        )


class CanDeleteIssue(BasePermission):
    """Admin or PM only."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.can_manage_projects
        )


class ReadOnly(BasePermission):
    """Allow GET/HEAD/OPTIONS for any authenticated user."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.method in ("GET", "HEAD", "OPTIONS")
        )
