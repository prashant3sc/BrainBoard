from django.test import TestCase
from rest_framework.test import APIClient

from issues.models import Issue
from projects.models import Project
from users.models import User
from wiki.models import WikiPage


def _make_user(email, role=User.DEVELOPER):
    return User.objects.create_user(email=email, password="pass1234", role=role, first_name=email.split("@")[0])


def _make_project(owner, key="SRCH"):
    return Project.objects.create(name="Search Project", owner=owner, key=key)


class SearchTests(TestCase):
    def setUp(self):
        self.user = _make_user("searcher@test.com")
        self.project = _make_project(self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

        self.issue = Issue.objects.create(
            title="Authentication bug fix",
            description="Fix login flow for OAuth",
            project=self.project,
            reporter=self.user,
            issue_type=Issue.BUG,
            priority=Issue.HIGH,
        )
        self.wiki_page = WikiPage.objects.create(
            title="Deployment Guide",
            content="Steps to deploy on Kubernetes",
            project=self.project,
        )

    # ── GET /search ──────────────────────────────────────────────────────────

    def test_get_search_returns_matching_issue(self):
        resp = self.client.get("/search", {"q": "Authentication"})
        self.assertEqual(resp.status_code, 200)
        types = [r["type"] for r in resp.data]
        self.assertIn("issue", types)
        titles = [r["title"] for r in resp.data]
        self.assertIn("Authentication bug fix", titles)

    def test_get_search_returns_matching_wiki(self):
        resp = self.client.get("/search", {"q": "Deployment"})
        self.assertEqual(resp.status_code, 200)
        types = [r["type"] for r in resp.data]
        self.assertIn("wiki", types)

    def test_get_search_matches_description(self):
        resp = self.client.get("/search", {"q": "OAuth"})
        self.assertEqual(resp.status_code, 200)
        ids = [r["id"] for r in resp.data]
        self.assertIn(str(self.issue.id), ids)

    def test_get_search_matches_wiki_content(self):
        resp = self.client.get("/search", {"q": "Kubernetes"})
        self.assertEqual(resp.status_code, 200)
        ids = [r["id"] for r in resp.data]
        self.assertIn(str(self.wiki_page.id), ids)

    def test_get_search_no_results(self):
        resp = self.client.get("/search", {"q": "xyznonexistentterm123"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_get_search_empty_query_returns_empty(self):
        resp = self.client.get("/search", {"q": ""})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_get_search_missing_q_returns_empty(self):
        resp = self.client.get("/search")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_search_result_shape(self):
        resp = self.client.get("/search", {"q": "Authentication"})
        self.assertEqual(resp.status_code, 200)
        self.assertGreater(len(resp.data), 0)
        result = resp.data[0]
        self.assertIn("id", result)
        self.assertIn("type", result)
        self.assertIn("title", result)
        self.assertIn("excerpt", result)
        self.assertIn("projectId", result)

    def test_search_result_project_id_matches(self):
        resp = self.client.get("/search", {"q": "Authentication"})
        for r in resp.data:
            if r["type"] == "issue":
                self.assertEqual(r["projectId"], str(self.project.id))

    # ── POST /search ─────────────────────────────────────────────────────────

    def test_post_search_returns_matching_issue(self):
        resp = self.client.post("/search", {"query": "Authentication"}, format="json")
        self.assertEqual(resp.status_code, 200)
        titles = [r["title"] for r in resp.data]
        self.assertIn("Authentication bug fix", titles)

    def test_post_search_empty_query_returns_empty(self):
        resp = self.client.post("/search", {"query": ""}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_post_search_returns_both_types(self):
        Issue.objects.create(
            title="Deploy issue", description="Kubernetes deploy failed",
            project=self.project, reporter=self.user,
            issue_type=Issue.TASK, priority=Issue.LOW,
        )
        resp = self.client.post("/search", {"query": "deploy"}, format="json")
        self.assertEqual(resp.status_code, 200)
        types = {r["type"] for r in resp.data}
        self.assertIn("issue", types)
        self.assertIn("wiki", types)

    # ── Auth guard ───────────────────────────────────────────────────────────

    def test_search_requires_authentication(self):
        resp = APIClient().get("/search", {"q": "anything"})
        self.assertEqual(resp.status_code, 401)

    def test_post_search_requires_authentication(self):
        resp = APIClient().post("/search", {"query": "anything"}, format="json")
        self.assertEqual(resp.status_code, 401)

    # ── Case insensitivity ───────────────────────────────────────────────────

    def test_search_is_case_insensitive(self):
        resp = self.client.get("/search", {"q": "authentication"})
        self.assertEqual(resp.status_code, 200)
        titles = [r["title"] for r in resp.data]
        self.assertIn("Authentication bug fix", titles)
