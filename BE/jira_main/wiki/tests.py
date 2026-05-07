from django.test import TestCase
from django.contrib.auth import get_user_model

from projects.models import Project, ProjectMember
from wiki.models import WikiPage, ProcessDefinition

User = get_user_model()


def _make_user(email, role="pm"):
    u = User.objects.create_user(email=email, password="pass", role=role, first_name=email.split("@")[0])
    return u


def _make_project(owner):
    return Project.objects.create(name="TestProj", key="TP", owner=owner, description="")


def _make_page(project, title="Test Page"):
    return WikiPage.objects.create(project=project, title=title, content="<p>content</p>")


class ProcessDefinitionModelTest(TestCase):
    def setUp(self):
        self.owner = _make_user("owner@test.com", "admin")
        self.project = _make_project(self.owner)
        self.page = _make_page(self.project)

    def test_create_process_definition(self):
        pd = ProcessDefinition.objects.create(
            wiki_page=self.page,
            project=self.project,
            category="checklist",
            trigger_contexts=["sprint_completion"],
            issue_type_scope=[],
            is_active=True,
            priority=0,
            created_by=self.owner,
        )
        self.assertEqual(str(pd), "[Checklist] Test Page")
        self.assertEqual(pd.category, "checklist")

    def test_matches_context_exact(self):
        pd = ProcessDefinition.objects.create(
            wiki_page=self.page,
            project=self.project,
            category="process",
            trigger_contexts=["issue_view", "bug"],
            issue_type_scope=["bug"],
            is_active=True,
        )
        self.assertTrue(pd.matches_context("issue_view", "bug"))
        self.assertTrue(pd.matches_context("bug", "bug"))

    def test_matches_context_wrong_context(self):
        pd = ProcessDefinition.objects.create(
            wiki_page=self.page,
            project=self.project,
            category="process",
            trigger_contexts=["sprint_completion"],
            issue_type_scope=[],
            is_active=True,
        )
        self.assertFalse(pd.matches_context("issue_view"))
        self.assertFalse(pd.matches_context("bug"))

    def test_matches_context_wrong_issue_type(self):
        pd = ProcessDefinition.objects.create(
            wiki_page=self.page,
            project=self.project,
            category="process",
            trigger_contexts=["issue_view"],
            issue_type_scope=["bug"],
            is_active=True,
        )
        self.assertFalse(pd.matches_context("issue_view", "task"))
        self.assertTrue(pd.matches_context("issue_view", "bug"))

    def test_matches_context_all_types(self):
        pd = ProcessDefinition.objects.create(
            wiki_page=self.page,
            project=self.project,
            category="process",
            trigger_contexts=["issue_creation"],
            issue_type_scope=["all"],
            is_active=True,
        )
        self.assertTrue(pd.matches_context("issue_creation", "task"))
        self.assertTrue(pd.matches_context("issue_creation", "bug"))

    def test_inactive_never_matches(self):
        pd = ProcessDefinition.objects.create(
            wiki_page=self.page,
            project=self.project,
            category="process",
            trigger_contexts=["issue_view"],
            issue_type_scope=[],
            is_active=False,
        )
        self.assertFalse(pd.matches_context("issue_view"))

    def test_empty_scope_matches_any_type(self):
        pd = ProcessDefinition.objects.create(
            wiki_page=self.page,
            project=self.project,
            category="process",
            trigger_contexts=["issue_view"],
            issue_type_scope=[],
            is_active=True,
        )
        self.assertTrue(pd.matches_context("issue_view", "task"))
        self.assertTrue(pd.matches_context("issue_view", "bug"))
        self.assertTrue(pd.matches_context("issue_view", None))


class ProcessDefinitionAPITest(TestCase):
    def setUp(self):
        self.pm = _make_user("pm@test.com", "pm")
        self.dev = _make_user("dev@test.com", "developer")
        self.project = _make_project(self.pm)
        ProjectMember.objects.create(project=self.project, user=self.pm)
        ProjectMember.objects.create(project=self.project, user=self.dev)
        self.page1 = _make_page(self.project, "Sprint Completion Checklist")
        self.page2 = _make_page(self.project, "Bug Triage Process")
        self.sprint_pd = ProcessDefinition.objects.create(
            wiki_page=self.page1,
            project=self.project,
            category="checklist",
            trigger_contexts=["sprint_completion"],
            issue_type_scope=[],
            is_active=True,
            priority=0,
            created_by=self.pm,
        )
        self.bug_pd = ProcessDefinition.objects.create(
            wiki_page=self.page2,
            project=self.project,
            category="process",
            trigger_contexts=["issue_view", "bug", "issue_creation"],
            issue_type_scope=["bug"],
            is_active=True,
            priority=1,
            created_by=self.pm,
        )

    def _auth(self, user):
        from rest_framework.test import APIClient
        c = APIClient()
        c.force_authenticate(user=user)
        return c

    def test_list_returns_all_for_pm(self):
        c = self._auth(self.pm)
        r = c.get(f"/projects/{self.project.id}/process-definitions")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 2)

    def test_list_returns_active_only_for_developer(self):
        self.sprint_pd.is_active = False
        self.sprint_pd.save()
        c = self._auth(self.dev)
        r = c.get(f"/projects/{self.project.id}/process-definitions")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()), 1)

    def test_match_sprint_completion(self):
        c = self._auth(self.dev)
        r = c.get(
            f"/projects/{self.project.id}/process-definitions/match",
            {"context": "sprint_completion"},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["wikiPageTitle"], "Sprint Completion Checklist")

    def test_match_issue_view_bug(self):
        c = self._auth(self.dev)
        r = c.get(
            f"/projects/{self.project.id}/process-definitions/match",
            {"context": "issue_view", "issue_type": "bug"},
        )
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["wikiPageTitle"], "Bug Triage Process")

    def test_match_issue_view_task_no_results(self):
        c = self._auth(self.dev)
        r = c.get(
            f"/projects/{self.project.id}/process-definitions/match",
            {"context": "issue_view", "issue_type": "task"},
        )
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), [])

    def test_create_requires_pm(self):
        c = self._auth(self.dev)
        page3 = _make_page(self.project, "New Process")
        r = c.post(
            f"/projects/{self.project.id}/process-definitions",
            data={
                "wikiPageId": str(page3.id),
                "category": "process",
                "trigger_contexts": ["issue_creation"],
                "issue_type_scope": [],
                "is_active": True,
                "priority": 5,
            },
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 403)

    def test_create_as_pm(self):
        c = self._auth(self.pm)
        page3 = _make_page(self.project, "New Process")
        r = c.post(
            f"/projects/{self.project.id}/process-definitions",
            data={
                "wikiPageId": str(page3.id),
                "category": "standard",
                "trigger_contexts": ["pr_review"],
                "issue_type_scope": [],
                "is_active": True,
                "priority": 2,
            },
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 201)
        body = r.json()
        self.assertEqual(body["category"], "standard")
        self.assertEqual(body["triggerContexts"], ["pr_review"])

    def test_delete_removes_definition(self):
        c = self._auth(self.pm)
        r = c.delete(f"/process-definitions/{self.sprint_pd.id}")
        self.assertEqual(r.status_code, 204)
        self.assertFalse(ProcessDefinition.objects.filter(id=self.sprint_pd.id).exists())

    def test_match_requires_context_param(self):
        c = self._auth(self.dev)
        r = c.get(f"/projects/{self.project.id}/process-definitions/match")
        self.assertEqual(r.status_code, 400)
