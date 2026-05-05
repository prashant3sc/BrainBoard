import json

from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from compliance.models import ComplianceCheck, ComplianceTemplate
from issues.models import Issue
from issues.serializers import IssueUpdateSerializer
from projects.models import Project
from users.models import User


def _make_user(email, role=User.DEVELOPER):
    return User.objects.create_user(email=email, password="pass", role=role, first_name=email.split("@")[0])


def _make_project(owner):
    return Project.objects.create(name="Test Project", owner=owner)


def _make_issue(project, issue_type=Issue.TASK, status=Issue.TODO):
    return Issue.objects.create(
        title="Test Issue",
        project=project,
        issue_type=issue_type,
        status=status,
        priority=Issue.MEDIUM,
    )


def _make_template(project, name="QA Sign-off", applies_to="all", blocks_on="done", required_role="developer", is_active=True):
    return ComplianceTemplate.objects.create(
        project=project,
        name=name,
        applies_to=applies_to,
        blocks_on=blocks_on,
        required_role=required_role,
        is_active=is_active,
    )


class ComplianceVisibilityTests(TestCase):
    """Compliance checks appear for matching issues and not for non-matching ones."""

    def setUp(self):
        self.user = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_checks_created_for_matching_issue_type(self):
        _make_template(self.project, applies_to="task")
        issue = _make_issue(self.project, issue_type=Issue.TASK)
        url = f"/issues/{issue.id}/compliance"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["templateName"], "QA Sign-off")
        self.assertEqual(resp.data[0]["status"], "pending")

    def test_no_checks_for_non_matching_issue_type(self):
        _make_template(self.project, applies_to="bug")
        issue = _make_issue(self.project, issue_type=Issue.TASK)
        url = f"/issues/{issue.id}/compliance"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 0)

    def test_all_applies_to_matches_every_type(self):
        _make_template(self.project, applies_to="all")
        for issue_type in [Issue.TASK, Issue.SUBTASK, Issue.BUG]:
            issue = _make_issue(self.project, issue_type=issue_type)
            url = f"/issues/{issue.id}/compliance"
            resp = self.client.get(url)
            self.assertEqual(len(resp.data), 1, f"Expected 1 check for {issue_type}")

    def test_inactive_template_not_shown(self):
        _make_template(self.project, is_active=False)
        issue = _make_issue(self.project)
        url = f"/issues/{issue.id}/compliance"
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 0)

    def test_checks_idempotent_on_repeated_get(self):
        _make_template(self.project)
        issue = _make_issue(self.project)
        url = f"/issues/{issue.id}/compliance"
        self.client.get(url)
        self.client.get(url)
        self.assertEqual(ComplianceCheck.objects.filter(issue=issue).count(), 1)


class CompliancePermissionTests(TestCase):
    """Role-based completion rules are enforced."""

    def setUp(self):
        self.admin = _make_user("admin@test.com", role=User.ADMIN)
        self.pm = _make_user("pm@test.com", role=User.PM)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.viewer = _make_user("viewer@test.com", role=User.VIEWER)
        self.project = _make_project(self.admin)
        self.issue = _make_issue(self.project)

    def _get_check(self, template):
        check, _ = ComplianceCheck.objects.get_or_create(issue=self.issue, template=template)
        return check

    def _patch_check(self, user, check, status="complete"):
        client = APIClient()
        client.force_authenticate(user=user)
        url = f"/issues/{self.issue.id}/compliance/{check.id}"
        return client.patch(url, {"status": status}, format="json")

    def test_developer_can_complete_developer_required_check(self):
        tpl = _make_template(self.project, required_role="developer")
        check = self._get_check(tpl)
        resp = self._patch_check(self.dev, check)
        self.assertEqual(resp.status_code, 200)
        check.refresh_from_db()
        self.assertEqual(check.status, ComplianceCheck.COMPLETE)
        self.assertEqual(check.completed_by, self.dev)

    def test_viewer_cannot_complete_developer_required_check(self):
        tpl = _make_template(self.project, required_role="developer")
        check = self._get_check(tpl)
        resp = self._patch_check(self.viewer, check)
        self.assertEqual(resp.status_code, 403)
        check.refresh_from_db()
        self.assertEqual(check.status, ComplianceCheck.PENDING)

    def test_developer_cannot_complete_pm_required_check(self):
        tpl = _make_template(self.project, required_role="pm")
        check = self._get_check(tpl)
        resp = self._patch_check(self.dev, check)
        self.assertEqual(resp.status_code, 403)

    def test_pm_can_complete_pm_required_check(self):
        tpl = _make_template(self.project, required_role="pm")
        check = self._get_check(tpl)
        resp = self._patch_check(self.pm, check)
        self.assertEqual(resp.status_code, 200)

    def test_admin_can_complete_any_check(self):
        for role in ["admin", "pm", "developer"]:
            tpl = _make_template(self.project, name=f"{role}-check", required_role=role)
            check = self._get_check(tpl)
            resp = self._patch_check(self.admin, check)
            self.assertEqual(resp.status_code, 200, f"Admin should complete {role}-required check")

    def test_completed_by_and_completed_at_set_on_completion(self):
        tpl = _make_template(self.project, required_role="developer")
        check = self._get_check(tpl)
        self._patch_check(self.dev, check)
        check.refresh_from_db()
        self.assertIsNotNone(check.completed_by)
        self.assertIsNotNone(check.completed_at)

    def test_reset_to_pending_clears_completed_by(self):
        tpl = _make_template(self.project, required_role="developer")
        check = self._get_check(tpl)
        self._patch_check(self.dev, check, status="complete")
        self._patch_check(self.dev, check, status="pending")
        check.refresh_from_db()
        self.assertIsNone(check.completed_by)
        self.assertIsNone(check.completed_at)


class ComplianceGatedTransitionTests(TestCase):
    """Status transitions are blocked/allowed based on compliance state."""

    def setUp(self):
        self.admin = _make_user("admin@test.com", role=User.ADMIN)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.admin)
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.admin)
        self.client_dev = APIClient()
        self.client_dev.force_authenticate(user=self.dev)

    def _patch_issue_status(self, client, issue, new_status):
        url = f"/issues/{issue.id}"
        return client.patch(url, {"status": new_status}, format="json")

    def test_transition_blocked_when_pending_compliance_check(self):
        tpl = _make_template(self.project, blocks_on="done")
        issue = _make_issue(self.project, issue_type=Issue.TASK)
        # Sync checks by GETting compliance endpoint
        self.client_dev.get(f"/issues/{issue.id}/compliance")
        resp = self._patch_issue_status(self.client_dev, issue, Issue.DONE)
        self.assertEqual(resp.status_code, 400)
        self.assertIn("compliance", str(resp.data).lower())
        issue.refresh_from_db()
        self.assertEqual(issue.status, Issue.TODO)

    def test_transition_allowed_after_check_completed(self):
        tpl = _make_template(self.project, blocks_on="done", required_role="developer")
        issue = _make_issue(self.project, issue_type=Issue.TASK)
        self.client_dev.get(f"/issues/{issue.id}/compliance")
        check = ComplianceCheck.objects.get(issue=issue, template=tpl)
        # Complete the check
        self.client_dev.patch(
            f"/issues/{issue.id}/compliance/{check.id}",
            {"status": "complete"},
            format="json",
        )
        # Now the transition should succeed
        resp = self._patch_issue_status(self.client_dev, issue, Issue.DONE)
        self.assertEqual(resp.status_code, 200)
        issue.refresh_from_db()
        self.assertEqual(issue.status, Issue.DONE)

    def test_transition_allowed_when_check_marked_not_required(self):
        tpl = _make_template(self.project, blocks_on="done", required_role="developer")
        issue = _make_issue(self.project, issue_type=Issue.TASK)
        self.client_dev.get(f"/issues/{issue.id}/compliance")
        check = ComplianceCheck.objects.get(issue=issue, template=tpl)
        self.client_dev.patch(
            f"/issues/{issue.id}/compliance/{check.id}",
            {"status": "not_required"},
            format="json",
        )
        resp = self._patch_issue_status(self.client_dev, issue, Issue.DONE)
        self.assertEqual(resp.status_code, 200)

    def test_transition_to_non_gated_status_always_allowed(self):
        _make_template(self.project, blocks_on="done")
        issue = _make_issue(self.project, issue_type=Issue.TASK)
        self.client_dev.get(f"/issues/{issue.id}/compliance")
        # Moving to in_progress (not gated) should succeed
        resp = self._patch_issue_status(self.client_dev, issue, Issue.IN_PROGRESS)
        self.assertEqual(resp.status_code, 200)

    def test_inactive_template_does_not_block_transition(self):
        _make_template(self.project, blocks_on="done", is_active=False)
        issue = _make_issue(self.project, issue_type=Issue.TASK)
        resp = self._patch_issue_status(self.client_dev, issue, Issue.DONE)
        self.assertEqual(resp.status_code, 200)

    def test_error_message_names_blocking_checks(self):
        _make_template(self.project, name="QA Sign-off", blocks_on="done")
        _make_template(self.project, name="Security Review", blocks_on="done")
        issue = _make_issue(self.project, issue_type=Issue.TASK)
        self.client_dev.get(f"/issues/{issue.id}/compliance")
        resp = self._patch_issue_status(self.client_dev, issue, Issue.DONE)
        self.assertEqual(resp.status_code, 400)
        error_text = str(resp.data)
        self.assertIn("QA Sign-off", error_text)
        self.assertIn("Security Review", error_text)

    def test_multiple_checks_all_must_complete_before_transition(self):
        tpl1 = _make_template(self.project, name="Check 1", blocks_on="done", required_role="developer")
        tpl2 = _make_template(self.project, name="Check 2", blocks_on="done", required_role="developer")
        issue = _make_issue(self.project, issue_type=Issue.TASK)
        self.client_dev.get(f"/issues/{issue.id}/compliance")
        check1 = ComplianceCheck.objects.get(issue=issue, template=tpl1)
        # Complete only the first check
        self.client_dev.patch(
            f"/issues/{issue.id}/compliance/{check1.id}",
            {"status": "complete"},
            format="json",
        )
        # Still blocked by check2
        resp = self._patch_issue_status(self.client_dev, issue, Issue.DONE)
        self.assertEqual(resp.status_code, 400)
        check2 = ComplianceCheck.objects.get(issue=issue, template=tpl2)
        self.client_dev.patch(
            f"/issues/{issue.id}/compliance/{check2.id}",
            {"status": "complete"},
            format="json",
        )
        # Now allowed
        resp = self._patch_issue_status(self.client_dev, issue, Issue.DONE)
        self.assertEqual(resp.status_code, 200)
