from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from issues.models import Issue
from projects.models import Project

from .models import ComplianceCheck, ComplianceTemplate
from .serializers import (
    ComplianceCheckSerializer,
    ComplianceCheckUpdateSerializer,
    ComplianceTemplateSerializer,
    ComplianceTemplateWriteSerializer,
)

ROLE_ORDER = {"admin": 0, "pm": 1, "developer": 2, "viewer": 3}


def _role_sufficient(user_role: str, required_role: str) -> bool:
    return ROLE_ORDER.get(user_role, 99) <= ROLE_ORDER.get(required_role, 99)


def _sync_checks_for_issue(issue: Issue):
    """
    Ensure a ComplianceCheck row exists for every active template that
    applies to this issue's type. New checks are created as 'pending'.
    Checks for deactivated templates are left untouched (not deleted).
    """
    templates = ComplianceTemplate.objects.filter(
        project=issue.project,
        is_active=True,
    ).filter(
        applies_to__in=[issue.issue_type, "all"]
    )
    existing_template_ids = set(
        issue.compliance_checks.values_list("template_id", flat=True)
    )
    new_checks = [
        ComplianceCheck(issue=issue, template=tpl)
        for tpl in templates
        if tpl.id not in existing_template_ids
    ]
    if new_checks:
        ComplianceCheck.objects.bulk_create(new_checks, ignore_conflicts=True)


# ─────────────────────────────────────────────────────────────────────────────
# Template management (project-level, admin/PM only)
# ─────────────────────────────────────────────────────────────────────────────

class ProjectComplianceTemplateListView(APIView):
    """
    GET  /projects/:projectId/compliance/templates
    POST /projects/:projectId/compliance/templates
    """
    permission_classes = [IsAuthenticated]

    def _get_project(self, project_id):
        try:
            return Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return None

    def get(self, request, project_id):
        project = self._get_project(project_id)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        templates = ComplianceTemplate.objects.filter(project=project)
        return Response(ComplianceTemplateSerializer(templates, many=True).data)

    def post(self, request, project_id):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        project = self._get_project(project_id)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ComplianceTemplateWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        template = serializer.save(project=project)
        return Response(ComplianceTemplateSerializer(template).data, status=status.HTTP_201_CREATED)


class ProjectComplianceTemplateDetailView(APIView):
    """
    PATCH  /projects/:projectId/compliance/templates/:templateId
    DELETE /projects/:projectId/compliance/templates/:templateId
    """
    permission_classes = [IsAuthenticated]

    def _get_template(self, project_id, template_id):
        try:
            return ComplianceTemplate.objects.get(pk=template_id, project_id=project_id)
        except ComplianceTemplate.DoesNotExist:
            return None

    def patch(self, request, project_id, template_id):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        template = self._get_template(project_id, template_id)
        if not template:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ComplianceTemplateWriteSerializer(template, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        template = serializer.save()
        return Response(ComplianceTemplateSerializer(template).data)

    def delete(self, request, project_id, template_id):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        template = self._get_template(project_id, template_id)
        if not template:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Issue-level compliance checks
# ─────────────────────────────────────────────────────────────────────────────

class IssueComplianceListView(APIView):
    """
    GET   /issues/:issueId/compliance   — list checks (auto-creates missing ones)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, issue_id):
        try:
            issue = Issue.objects.select_related("project").get(pk=issue_id)
        except Issue.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        _sync_checks_for_issue(issue)
        checks = (
            issue.compliance_checks
            .select_related("template", "completed_by")
            .filter(template__is_active=True)
        )
        return Response(ComplianceCheckSerializer(checks, many=True).data)


class IssueComplianceCheckDetailView(APIView):
    """
    PATCH /issues/:issueId/compliance/:checkId  — update status/note
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, issue_id, check_id):
        try:
            check = ComplianceCheck.objects.select_related(
                "template", "issue__project"
            ).get(pk=check_id, issue_id=issue_id)
        except ComplianceCheck.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = ComplianceCheckUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        new_status = serializer.validated_data["status"]

        # Role gate: only roles >= required_role can mark complete
        if new_status == ComplianceCheck.COMPLETE:
            if not _role_sufficient(request.user.role, check.template.required_role):
                return Response(
                    {"detail": f"Only a {check.template.required_role} or above can complete this check."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        check.status = new_status
        check.note = serializer.validated_data.get("note", check.note)
        if new_status == ComplianceCheck.COMPLETE:
            check.completed_by = request.user
            check.completed_at = timezone.now()
        elif new_status == ComplianceCheck.PENDING:
            check.completed_by = None
            check.completed_at = None
        check.save()

        return Response(ComplianceCheckSerializer(check).data)


# ─────────────────────────────────────────────────────────────────────────────
# Analytics
# ─────────────────────────────────────────────────────────────────────────────

class ProjectComplianceAnalyticsView(APIView):
    """
    GET /projects/:projectId/compliance/analytics
    Returns per-template and per-issue compliance stats.
    Optional ?sprint_id= filter.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, project_id):
        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        sprint_id = request.query_params.get("sprint_id")

        issue_qs = Issue.objects.filter(project=project)
        if sprint_id:
            issue_qs = issue_qs.filter(sprint_id=sprint_id)

        issue_ids = list(issue_qs.values_list("id", flat=True))

        templates = ComplianceTemplate.objects.filter(project=project, is_active=True)

        per_template = []
        for tpl in templates:
            checks = ComplianceCheck.objects.filter(
                template=tpl,
                issue_id__in=issue_ids,
            )
            total      = checks.count()
            complete   = checks.filter(status=ComplianceCheck.COMPLETE).count()
            pending    = checks.filter(status=ComplianceCheck.PENDING).count()
            blocked    = checks.filter(status=ComplianceCheck.BLOCKED).count()
            not_req    = checks.filter(status=ComplianceCheck.NOT_REQUIRED).count()
            per_template.append({
                "templateId":   str(tpl.id),
                "templateName": tpl.name,
                "total":        total,
                "complete":     complete,
                "pending":      pending,
                "blocked":      blocked,
                "notRequired":  not_req,
                "rate":         round((complete / total * 100) if total else 0, 1),
            })

        # Sprint-level summary: how many issues are fully compliant
        checks_by_issue = {}
        all_checks = ComplianceCheck.objects.filter(issue_id__in=issue_ids).select_related("template")
        for c in all_checks:
            checks_by_issue.setdefault(str(c.issue_id), []).append(c)

        fully_compliant = 0
        has_blockers    = 0
        for iid in issue_ids:
            issue_checks = checks_by_issue.get(str(iid), [])
            if not issue_checks:
                continue
            blocking = [
                c for c in issue_checks
                if c.template.blocks_on and c.status not in (ComplianceCheck.COMPLETE, ComplianceCheck.NOT_REQUIRED)
            ]
            if not blocking:
                fully_compliant += 1
            else:
                has_blockers += 1

        return Response({
            "perTemplate":     per_template,
            "totalIssues":     len(issue_ids),
            "fullyCompliant":  fully_compliant,
            "hasBlockers":     has_blockers,
        })
