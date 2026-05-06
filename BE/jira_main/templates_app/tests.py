from django.test import TestCase
from rest_framework.test import APIClient

from projects.models import Project
from templates_app.models import WorkflowTemplate
from users.models import User


def _make_user(email, role=User.DEVELOPER):
    return User.objects.create_user(email=email, password="pass1234", role=role, first_name=email.split("@")[0])


def _make_project(owner, key="TMPL"):
    return Project.objects.create(name="Template Project", owner=owner, key=key)


def _auth(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _make_system_template(template_type=WorkflowTemplate.PROJECT, name="System Template"):
    return WorkflowTemplate.objects.create(
        name=name,
        template_type=template_type,
        is_system=True,
        is_active=True,
        config={},
    )


def _make_project_template(project, creator, name="Custom Template", template_type=WorkflowTemplate.ISSUE):
    return WorkflowTemplate.objects.create(
        name=name,
        template_type=template_type,
        project=project,
        created_by=creator,
        is_system=False,
        is_active=True,
        config={},
    )


class TemplateListTests(TestCase):
    def setUp(self):
        self.pm = _make_user("pm@test.com", role=User.PM)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.pm)
        self.pm_client = _auth(self.pm)
        self.dev_client = _auth(self.dev)
        _make_system_template(WorkflowTemplate.PROJECT, "Scrum Project")
        _make_system_template(WorkflowTemplate.ISSUE, "Bug Report Template")
        _make_project_template(self.project, self.pm, "Custom Issue", WorkflowTemplate.ISSUE)

    def test_list_system_templates_only(self):
        resp = self.dev_client.get("/templates")
        self.assertEqual(resp.status_code, 200)
        for t in resp.data:
            self.assertIsNone(t.get("project"))

    def test_filter_templates_by_type(self):
        resp = self.dev_client.get("/templates", {"type": WorkflowTemplate.PROJECT})
        self.assertEqual(resp.status_code, 200)
        for t in resp.data:
            self.assertEqual(t["template_type"], WorkflowTemplate.PROJECT)

    def test_list_with_project_id_includes_custom_templates(self):
        resp = self.dev_client.get("/templates", {"project_id": str(self.project.id)})
        self.assertEqual(resp.status_code, 200)
        names = [t["name"] for t in resp.data]
        self.assertIn("Custom Issue", names)

    def test_inactive_templates_excluded(self):
        t = _make_system_template(WorkflowTemplate.WIKI, "Inactive Wiki")
        t.is_active = False
        t.save()
        resp = self.dev_client.get("/templates")
        names = [x["name"] for x in resp.data]
        self.assertNotIn("Inactive Wiki", names)

    def test_unauthenticated_cannot_list_templates(self):
        resp = APIClient().get("/templates")
        self.assertEqual(resp.status_code, 401)


class ProjectTemplateTests(TestCase):
    def setUp(self):
        self.pm = _make_user("pm@test.com", role=User.PM)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.pm)
        self.pm_client = _auth(self.pm)
        self.dev_client = _auth(self.dev)

    def test_pm_can_create_project_template(self):
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/templates",
            {
                "name": "Sprint Template",
                "template_type": WorkflowTemplate.ISSUE,
                "description": "Standard sprint issue template",
                "config": {},
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(WorkflowTemplate.objects.filter(name="Sprint Template", project=self.project).exists())

    def test_developer_cannot_create_project_template(self):
        resp = self.dev_client.post(
            f"/projects/{self.project.id}/templates",
            {"name": "Hacker Template", "template_type": WorkflowTemplate.ISSUE, "config": {}},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_list_project_templates_includes_system_and_custom(self):
        _make_system_template(WorkflowTemplate.ISSUE, "Global Issue")
        _make_project_template(self.project, self.pm, "Local Issue", WorkflowTemplate.ISSUE)
        resp = self.pm_client.get(f"/projects/{self.project.id}/templates")
        self.assertEqual(resp.status_code, 200)
        names = [t["name"] for t in resp.data]
        self.assertIn("Global Issue", names)
        self.assertIn("Local Issue", names)

    def test_list_project_templates_filter_by_type(self):
        _make_project_template(self.project, self.pm, "Wiki Tmpl", WorkflowTemplate.WIKI)
        resp = self.pm_client.get(
            f"/projects/{self.project.id}/templates",
            {"type": WorkflowTemplate.ISSUE},
        )
        for t in resp.data:
            self.assertEqual(t["template_type"], WorkflowTemplate.ISSUE)

    def test_list_templates_for_nonexistent_project(self):
        import uuid
        resp = self.pm_client.get(f"/projects/{uuid.uuid4()}/templates")
        self.assertEqual(resp.status_code, 404)


class TemplateDetailTests(TestCase):
    def setUp(self):
        self.pm = _make_user("pm@test.com", role=User.PM)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.pm)
        self.pm_client = _auth(self.pm)
        self.dev_client = _auth(self.dev)
        self.custom = _make_project_template(self.project, self.pm, "Editable", WorkflowTemplate.ISSUE)
        self.system = _make_system_template(WorkflowTemplate.PROJECT, "Protected System")

    def test_pm_can_update_custom_template(self):
        resp = self.pm_client.patch(
            f"/templates/{self.custom.id}",
            {"name": "Renamed"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.custom.refresh_from_db()
        self.assertEqual(self.custom.name, "Renamed")

    def test_cannot_modify_system_template(self):
        resp = self.pm_client.patch(
            f"/templates/{self.system.id}",
            {"name": "Sneaky rename"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_developer_cannot_update_template(self):
        resp = self.dev_client.patch(
            f"/templates/{self.custom.id}",
            {"name": "Dev rename"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_pm_can_delete_custom_template(self):
        resp = self.pm_client.delete(f"/templates/{self.custom.id}")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(WorkflowTemplate.objects.filter(id=self.custom.id).exists())

    def test_cannot_delete_system_template(self):
        resp = self.pm_client.delete(f"/templates/{self.system.id}")
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(WorkflowTemplate.objects.filter(id=self.system.id).exists())

    def test_delete_nonexistent_template_returns_404(self):
        import uuid
        resp = self.pm_client.delete(f"/templates/{uuid.uuid4()}")
        self.assertEqual(resp.status_code, 404)


class ApplyTemplateTests(TestCase):
    def setUp(self):
        self.pm = _make_user("pm@test.com", role=User.PM)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.pm, key="APPLY")
        self.pm_client = _auth(self.pm)
        self.dev_client = _auth(self.dev)
        self.template = WorkflowTemplate.objects.create(
            name="Full Setup",
            template_type=WorkflowTemplate.PROJECT,
            is_system=True,
            is_active=True,
            config={
                "labels": [
                    {"name": "Security", "color": "#FF0000"},
                    {"name": "Performance", "color": "#00FF00"},
                ],
                "wiki_pages": [
                    {"title": "Architecture Overview", "content": "<p>Arch docs</p>", "children": [
                        {"title": "Database Schema", "content": "<p>Schema</p>"},
                    ]},
                ],
                "compliance_templates": [
                    {"name": "Security Review", "applies_to": "all", "blocks_on": "done", "required_role": "pm"},
                ],
            },
        )

    def test_apply_template_seeds_labels(self):
        from issues.models import Label
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/apply-template",
            {"templateId": str(self.template.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        label_names = set(Label.objects.filter(project=self.project).values_list("name", flat=True))
        self.assertIn("Security", label_names)
        self.assertIn("Performance", label_names)

    def test_apply_template_seeds_wiki_pages(self):
        from wiki.models import WikiPage
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/apply-template",
            {"templateId": str(self.template.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        page_titles = set(WikiPage.objects.filter(project=self.project).values_list("title", flat=True))
        self.assertIn("Architecture Overview", page_titles)
        self.assertIn("Database Schema", page_titles)

    def test_apply_template_seeds_compliance_templates(self):
        from compliance.models import ComplianceTemplate
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/apply-template",
            {"templateId": str(self.template.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(ComplianceTemplate.objects.filter(project=self.project, name="Security Review").exists())

    def test_apply_template_is_idempotent_for_labels(self):
        from issues.models import Label
        self.pm_client.post(
            f"/projects/{self.project.id}/apply-template",
            {"templateId": str(self.template.id)},
            format="json",
        )
        self.pm_client.post(
            f"/projects/{self.project.id}/apply-template",
            {"templateId": str(self.template.id)},
            format="json",
        )
        self.assertEqual(Label.objects.filter(project=self.project, name="Security").count(), 1)

    def test_apply_template_response_includes_summary(self):
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/apply-template",
            {"templateId": str(self.template.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("applied", resp.data)
        self.assertIn("labels", resp.data["applied"])
        self.assertIn("wiki_pages", resp.data["applied"])
        self.assertIn("compliance_templates", resp.data["applied"])

    def test_apply_template_requires_template_id(self):
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/apply-template",
            {},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_developer_cannot_apply_template(self):
        resp = self.dev_client.post(
            f"/projects/{self.project.id}/apply-template",
            {"templateId": str(self.template.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_apply_nonexistent_template_returns_404(self):
        import uuid
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/apply-template",
            {"templateId": str(uuid.uuid4())},
            format="json",
        )
        self.assertEqual(resp.status_code, 404)

    def test_apply_to_nonexistent_project_returns_404(self):
        import uuid
        resp = self.pm_client.post(
            f"/projects/{uuid.uuid4()}/apply-template",
            {"templateId": str(self.template.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 404)
