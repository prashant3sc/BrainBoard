from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from projects.models import Project
from .models import WorkflowTemplate
from .serializers import WorkflowTemplateSerializer, WorkflowTemplateWriteSerializer


# ─────────────────────────────────────────────────────────────────────────────
# Template listing (system + project-scoped)
# ─────────────────────────────────────────────────────────────────────────────

class TemplateListView(APIView):
    """
    GET /templates?type=project|issue|wiki[&project_id=<uuid>]

    Returns system templates + any custom templates for the given project.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ttype      = request.query_params.get("type")
        project_id = request.query_params.get("project_id")

        qs = WorkflowTemplate.objects.filter(is_active=True)

        if ttype:
            qs = qs.filter(template_type=ttype)

        # Always include system templates; add project-specific if project_id given
        if project_id:
            qs = qs.filter(Q(project__isnull=True) | Q(project_id=project_id))
        else:
            qs = qs.filter(project__isnull=True)

        return Response(WorkflowTemplateSerializer(qs, many=True).data)


# ─────────────────────────────────────────────────────────────────────────────
# Project-scoped template management
# ─────────────────────────────────────────────────────────────────────────────

class ProjectTemplateListView(APIView):
    """
    GET  /projects/:projectId/templates[?type=...]   — list templates for a project
    POST /projects/:projectId/templates              — create a custom project template
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

        ttype = request.query_params.get("type")
        qs = WorkflowTemplate.objects.filter(
            Q(project__isnull=True) | Q(project=project),
            is_active=True,
        )
        if ttype:
            qs = qs.filter(template_type=ttype)

        return Response(WorkflowTemplateSerializer(qs, many=True).data)

    def post(self, request, project_id):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        project = self._get_project(project_id)
        if not project:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = WorkflowTemplateWriteSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        template = serializer.save(project=project, created_by=request.user, is_system=False)
        return Response(WorkflowTemplateSerializer(template).data, status=status.HTTP_201_CREATED)


class TemplateDetailView(APIView):
    """
    PATCH  /templates/:id   — update (non-system templates only, admin/PM)
    DELETE /templates/:id   — delete (non-system templates only, admin/PM)
    """
    permission_classes = [IsAuthenticated]

    def _get_template(self, pk):
        try:
            return WorkflowTemplate.objects.get(pk=pk)
        except WorkflowTemplate.DoesNotExist:
            return None

    def patch(self, request, pk):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        template = self._get_template(pk)
        if not template:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if template.is_system:
            return Response({"detail": "System templates cannot be modified."}, status=status.HTTP_403_FORBIDDEN)

        serializer = WorkflowTemplateWriteSerializer(template, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        template = serializer.save()
        return Response(WorkflowTemplateSerializer(template).data)

    def delete(self, request, pk):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        template = self._get_template(pk)
        if not template:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        if template.is_system:
            return Response({"detail": "System templates cannot be deleted."}, status=status.HTTP_403_FORBIDDEN)
        template.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─────────────────────────────────────────────────────────────────────────────
# Apply a project template to an existing project
# ─────────────────────────────────────────────────────────────────────────────

class ApplyProjectTemplateView(APIView):
    """
    POST /projects/:projectId/apply-template
    Body: { "templateId": "<uuid>" }

    Seeds labels, wiki pages, and compliance templates defined in the template
    config into the target project. Safe to call after project creation.
    Skips existing labels by name to stay idempotent.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, project_id):
        if not request.user.can_manage_projects:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        try:
            project = Project.objects.get(pk=project_id)
        except Project.DoesNotExist:
            return Response({"detail": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        template_id = request.data.get("templateId")
        if not template_id:
            return Response({"detail": "templateId is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            template = WorkflowTemplate.objects.get(pk=template_id, template_type=WorkflowTemplate.PROJECT)
        except WorkflowTemplate.DoesNotExist:
            return Response({"detail": "Template not found"}, status=status.HTTP_404_NOT_FOUND)

        config = template.config or {}
        summary = {"labels": [], "wiki_pages": [], "compliance_templates": []}

        # 1. Seed labels
        from issues.models import Label
        existing_label_names = set(Label.objects.filter(project=project).values_list("name", flat=True))
        for lbl in config.get("labels", []):
            if lbl["name"] not in existing_label_names:
                Label.objects.create(project=project, name=lbl["name"], color=lbl.get("color", "#888888"))
                summary["labels"].append(lbl["name"])

        # 2. Seed wiki pages (with children recursively)
        from wiki.models import WikiPage, WikiPageVersion

        def create_wiki_page(page_def, parent=None):
            page = WikiPage.objects.create(
                project=project,
                title=page_def["title"],
                content=page_def.get("content", ""),
                parent=parent,
                created_by=request.user,
                updated_by=request.user,
            )
            WikiPageVersion.objects.create(
                page=page,
                version_number=1,
                title=page.title,
                content=page.content,
                created_by=request.user,
            )
            summary["wiki_pages"].append(page_def["title"])
            for child in page_def.get("children", []):
                create_wiki_page(child, parent=page)

        for page_def in config.get("wiki_pages", []):
            create_wiki_page(page_def)

        # 3. Seed compliance templates
        from compliance.models import ComplianceTemplate
        existing_compliance_names = set(
            ComplianceTemplate.objects.filter(project=project).values_list("name", flat=True)
        )
        for ct in config.get("compliance_templates", []):
            if ct["name"] not in existing_compliance_names:
                ComplianceTemplate.objects.create(
                    project=project,
                    name=ct["name"],
                    applies_to=ct.get("applies_to", "all"),
                    blocks_on=ct.get("blocks_on", ""),
                    required_role=ct.get("required_role", "developer"),
                )
                summary["compliance_templates"].append(ct["name"])

        return Response({"applied": summary}, status=status.HTTP_200_OK)
