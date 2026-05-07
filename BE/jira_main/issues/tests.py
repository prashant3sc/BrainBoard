from django.test import TestCase
from rest_framework.test import APIClient

from issues.models import Comment, Issue, Label
from projects.models import Project, ProjectMember
from users.models import User


def _make_user(email, role=User.DEVELOPER):
    return User.objects.create_user(email=email, password="pass1234", role=role, first_name=email.split("@")[0])


def _make_project(owner, key="TP"):
    p = Project.objects.create(name="Test Project", owner=owner, key=key)
    ProjectMember.objects.get_or_create(project=p, user=owner)
    return p


def _make_issue(project, reporter, title="Test Issue", issue_type=Issue.TASK, status=Issue.TODO):
    return Issue.objects.create(
        title=title,
        project=project,
        reporter=reporter,
        issue_type=issue_type,
        status=status,
        priority=Issue.MEDIUM,
    )


def _auth(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


class IssueCRUDTests(TestCase):
    def setUp(self):
        self.admin = _make_user("admin@test.com", role=User.ADMIN)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.viewer = _make_user("viewer@test.com", role=User.VIEWER)
        self.project = _make_project(self.admin, key="ISS")
        self.admin_client = _auth(self.admin)
        self.dev_client = _auth(self.dev)
        self.viewer_client = _auth(self.viewer)

    def test_create_issue_as_developer(self):
        resp = self.dev_client.post(
            "/issues",
            {
                "title": "Fix bug",
                "projectId": str(self.project.id),
                "issue_type": Issue.BUG,
                "priority": Issue.HIGH,
                "status": Issue.TODO,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Issue.objects.filter(title="Fix bug").exists())

    def test_viewer_cannot_create_issue(self):
        resp = self.viewer_client.post(
            "/issues",
            {"title": "Spy Issue", "projectId": str(self.project.id), "issue_type": Issue.TASK, "priority": Issue.LOW},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_unauthenticated_cannot_create_issue(self):
        resp = APIClient().post(
            "/issues",
            {"title": "No Auth", "projectId": str(self.project.id), "issue_type": Issue.TASK, "priority": Issue.LOW},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_list_issues_by_project(self):
        _make_issue(self.project, self.dev, title="Issue 1")
        _make_issue(self.project, self.dev, title="Issue 2")
        resp = self.dev_client.get(f"/projects/{self.project.id}/issues")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_list_issues_empty_project(self):
        p2 = _make_project(self.admin, key="EMP")
        resp = self.dev_client.get(f"/projects/{p2.id}/issues")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 0)

    def test_retrieve_issue_by_uuid(self):
        issue = _make_issue(self.project, self.dev, title="UUID Lookup")
        resp = self.dev_client.get(f"/issues/{issue.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["title"], "UUID Lookup")

    def test_retrieve_issue_by_ticket_id(self):
        issue = _make_issue(self.project, self.dev, title="Ticket Key Lookup")
        issue.sequence_number = 42
        issue.save()
        resp = self.dev_client.get(f"/issues/{self.project.key}-42")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["title"], "Ticket Key Lookup")

    def test_update_issue_status(self):
        issue = _make_issue(self.project, self.dev, title="Update Status")
        resp = self.dev_client.patch(f"/issues/{issue.id}", {"status": Issue.IN_PROGRESS}, format="json")
        self.assertEqual(resp.status_code, 200)
        issue.refresh_from_db()
        self.assertEqual(issue.status, Issue.IN_PROGRESS)

    def test_update_issue_priority(self):
        issue = _make_issue(self.project, self.dev, title="Update Priority")
        resp = self.dev_client.patch(f"/issues/{issue.id}", {"priority": Issue.CRITICAL}, format="json")
        self.assertEqual(resp.status_code, 200)
        issue.refresh_from_db()
        self.assertEqual(issue.priority, Issue.CRITICAL)

    def test_delete_issue(self):
        issue = _make_issue(self.project, self.dev, title="Delete Me")
        resp = self.dev_client.delete(f"/issues/{issue.id}")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Issue.objects.filter(id=issue.id).exists())

    def test_retrieve_nonexistent_issue_returns_404(self):
        import uuid
        resp = self.dev_client.get(f"/issues/{uuid.uuid4()}")
        self.assertEqual(resp.status_code, 404)

    def test_filter_issues_by_status(self):
        _make_issue(self.project, self.dev, title="Todo", status=Issue.TODO)
        _make_issue(self.project, self.dev, title="Done", status=Issue.DONE)
        resp = self.dev_client.get(f"/projects/{self.project.id}/issues", {"status": Issue.TODO})
        self.assertEqual(resp.status_code, 200)
        for issue in resp.data:
            self.assertEqual(issue["status"], Issue.TODO)

    def test_filter_issues_by_priority(self):
        _make_issue(self.project, self.dev, title="High Issue", status=Issue.TODO)
        issue = Issue.objects.get(title="High Issue")
        issue.priority = Issue.HIGH
        issue.save()
        resp = self.dev_client.get(f"/projects/{self.project.id}/issues", {"priority": Issue.HIGH})
        self.assertEqual(resp.status_code, 200)
        for i in resp.data:
            self.assertEqual(i["priority"], Issue.HIGH)


class SubtaskTests(TestCase):
    def setUp(self):
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.dev, key="SUB")
        self.client = _auth(self.dev)

    def test_create_subtask_with_parent(self):
        parent = _make_issue(self.project, self.dev, title="Parent Task")
        resp = self.client.post(
            "/issues",
            {
                "title": "Child Task",
                "projectId": str(self.project.id),
                "issue_type": Issue.SUBTASK,
                "priority": Issue.LOW,
                "parentId": str(parent.id),
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        child = Issue.objects.get(title="Child Task")
        self.assertEqual(child.parent_id, parent.id)

    def test_subtask_count_in_serializer(self):
        parent = _make_issue(self.project, self.dev, title="Parent")
        Issue.objects.create(
            title="Child", project=self.project, reporter=self.dev,
            issue_type=Issue.SUBTASK, priority=Issue.LOW, parent=parent,
        )
        resp = self.client.get(f"/issues/{parent.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["subtaskCount"], 1)

    def test_progress_is_zero_when_no_subtasks(self):
        issue = _make_issue(self.project, self.dev, title="No Subtasks")
        resp = self.client.get(f"/issues/{issue.id}")
        self.assertEqual(resp.data["progress"], 0)

    def test_progress_increases_as_subtasks_done(self):
        parent = _make_issue(self.project, self.dev, title="Parent Progress")
        child1 = Issue.objects.create(
            title="Child 1", project=self.project, reporter=self.dev,
            issue_type=Issue.SUBTASK, priority=Issue.LOW, parent=parent, status=Issue.DONE,
        )
        Issue.objects.create(
            title="Child 2", project=self.project, reporter=self.dev,
            issue_type=Issue.SUBTASK, priority=Issue.LOW, parent=parent, status=Issue.TODO,
        )
        resp = self.client.get(f"/issues/{parent.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["progress"], 50)


class CommentTests(TestCase):
    def setUp(self):
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.other = _make_user("other@test.com", role=User.DEVELOPER)
        self.viewer = _make_user("viewer@test.com", role=User.VIEWER)
        self.project = _make_project(self.dev, key="CMT")
        self.issue = _make_issue(self.project, self.dev, title="Commented Issue")
        ProjectMember.objects.get_or_create(project=self.project, user=self.other)
        ProjectMember.objects.get_or_create(project=self.project, user=self.viewer)
        self.dev_client = _auth(self.dev)
        self.other_client = _auth(self.other)
        self.viewer_client = _auth(self.viewer)

    def test_add_comment(self):
        resp = self.dev_client.post(
            f"/issues/{self.issue.id}/comments",
            {"body": "First comment"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Comment.objects.filter(ticket=self.issue, body="First comment").exists())

    def test_list_comments(self):
        Comment.objects.create(ticket=self.issue, author=self.dev, body="Comment A")
        Comment.objects.create(ticket=self.issue, author=self.dev, body="Comment B")
        resp = self.dev_client.get(f"/issues/{self.issue.id}/comments")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_viewer_can_read_comments(self):
        Comment.objects.create(ticket=self.issue, author=self.dev, body="Public comment")
        resp = self.viewer_client.get(f"/issues/{self.issue.id}/comments")
        self.assertEqual(resp.status_code, 200)

    def test_reply_to_comment(self):
        parent_comment = Comment.objects.create(ticket=self.issue, author=self.dev, body="Parent")
        resp = self.other_client.post(
            f"/issues/{self.issue.id}/comments",
            {"body": "Reply here", "parentId": str(parent_comment.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        reply = Comment.objects.get(body="Reply here")
        self.assertEqual(reply.parent_id, parent_comment.id)

    def test_edit_own_comment(self):
        comment = Comment.objects.create(ticket=self.issue, author=self.dev, body="Original")
        resp = self.dev_client.patch(f"/comments/{comment.id}", {"body": "Updated"}, format="json")
        self.assertEqual(resp.status_code, 200)
        comment.refresh_from_db()
        self.assertEqual(comment.body, "Updated")

    def test_cannot_edit_others_comment(self):
        comment = Comment.objects.create(ticket=self.issue, author=self.dev, body="Mine")
        resp = self.other_client.patch(f"/comments/{comment.id}", {"body": "Hijacked"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_delete_own_comment(self):
        comment = Comment.objects.create(ticket=self.issue, author=self.dev, body="To delete")
        resp = self.dev_client.delete(f"/comments/{comment.id}")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Comment.objects.filter(id=comment.id).exists())

    def test_cannot_delete_others_comment(self):
        comment = Comment.objects.create(ticket=self.issue, author=self.dev, body="Protected")
        resp = self.other_client.delete(f"/comments/{comment.id}")
        self.assertEqual(resp.status_code, 403)

    def test_comment_count_in_issue_serializer(self):
        Comment.objects.create(ticket=self.issue, author=self.dev, body="C1")
        Comment.objects.create(ticket=self.issue, author=self.dev, body="C2")
        resp = self.dev_client.get(f"/issues/{self.issue.id}")
        self.assertEqual(resp.data["commentCount"], 2)


class LabelTests(TestCase):
    def setUp(self):
        self.pm = _make_user("pm@test.com", role=User.PM)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.pm, key="LBL")
        self.pm_client = _auth(self.pm)
        self.dev_client = _auth(self.dev)

    def test_list_labels(self):
        Label.objects.create(project=self.project, name="Bug", color="#FF0000")
        resp = self.pm_client.get(f"/projects/{self.project.id}/labels")
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.data), 1)

    def test_create_label(self):
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/labels",
            {"name": "Critical", "color": "#FF0000"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Label.objects.filter(project=self.project, name="Critical").exists())

    def test_duplicate_label_name_rejected(self):
        Label.objects.create(project=self.project, name="Dup", color="#000000")
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/labels",
            {"name": "Dup", "color": "#111111"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_update_label(self):
        label = Label.objects.create(project=self.project, name="Old", color="#AAAAAA")
        resp = self.pm_client.patch(
            f"/projects/{self.project.id}/labels/{label.id}",
            {"name": "New", "color": "#BBBBBB"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        label.refresh_from_db()
        self.assertEqual(label.name, "New")

    def test_delete_label(self):
        label = Label.objects.create(project=self.project, name="Gone", color="#CCCCCC")
        resp = self.pm_client.delete(f"/projects/{self.project.id}/labels/{label.id}")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Label.objects.filter(id=label.id).exists())

    def test_developer_can_read_labels(self):
        Label.objects.create(project=self.project, name="Visible", color="#DDDDDD")
        resp = self.dev_client.get(f"/projects/{self.project.id}/labels")
        self.assertEqual(resp.status_code, 200)

    def test_nonexistent_label_returns_404(self):
        import uuid
        resp = self.pm_client.get(f"/projects/{self.project.id}/labels/{uuid.uuid4()}")
        self.assertEqual(resp.status_code, 404)
