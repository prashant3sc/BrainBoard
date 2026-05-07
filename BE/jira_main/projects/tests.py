from django.test import TestCase
from rest_framework.test import APIClient

from projects.models import Project, ProjectMember, Sprint
from users.models import User


def _make_user(email, role=User.DEVELOPER):
    return User.objects.create_user(email=email, password="pass1234", role=role, first_name=email.split("@")[0])


def _make_project(owner, name="Test Project", key="TP"):
    return Project.objects.create(name=name, owner=owner, key=key)


def _auth(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


class ProjectCRUDTests(TestCase):
    def setUp(self):
        self.admin = _make_user("admin@test.com", role=User.ADMIN)
        self.pm = _make_user("pm@test.com", role=User.PM)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)

    def test_admin_can_create_project(self):
        c = _auth(self.admin)
        resp = c.post("/projects/create", {"name": "Alpha", "key": "ALP", "description": ""}, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Project.objects.filter(key="ALP").exists())

    def test_pm_can_create_project(self):
        c = _auth(self.pm)
        resp = c.post("/projects/create", {"name": "Beta", "key": "BET", "description": ""}, format="json")
        self.assertEqual(resp.status_code, 201)

    def test_developer_cannot_create_project(self):
        c = _auth(self.dev)
        resp = c.post("/projects/create", {"name": "Gamma", "key": "GAM", "description": ""}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_duplicate_key_rejected(self):
        _make_project(self.admin, key="DUP")
        c = _auth(self.admin)
        resp = c.post("/projects/create", {"name": "Dup2", "key": "DUP", "description": ""}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_key_must_be_uppercase(self):
        c = _auth(self.pm)
        resp = c.post("/projects/create", {"name": "Lower", "key": "low", "description": ""}, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_owner_auto_added_as_member(self):
        c = _auth(self.pm)
        resp = c.post("/projects/create", {"name": "Proj", "key": "PROJ", "description": ""}, format="json")
        self.assertEqual(resp.status_code, 201)
        project = Project.objects.get(key="PROJ")
        self.assertTrue(ProjectMember.objects.filter(project=project, user=self.pm).exists())

    def test_default_labels_seeded(self):
        from issues.models import Label
        c = _auth(self.pm)
        c.post("/projects/create", {"name": "Lab", "key": "LAB", "description": ""}, format="json")
        project = Project.objects.get(key="LAB")
        label_names = set(Label.objects.filter(project=project).values_list("name", flat=True))
        self.assertIn("Frontend", label_names)
        self.assertIn("Backend", label_names)
        self.assertIn("QA Testing", label_names)

    def test_admin_sees_all_projects(self):
        _make_project(self.pm, name="P1", key="P1")
        _make_project(self.admin, name="P2", key="P2")
        c = _auth(self.admin)
        resp = c.get("/projects")
        self.assertEqual(resp.status_code, 200)
        self.assertGreaterEqual(len(resp.data), 2)

    def test_developer_sees_only_own_projects(self):
        p1 = _make_project(self.admin, name="Admin Proj", key="AP")
        p2 = _make_project(self.dev, name="Dev Proj", key="DP")
        c = _auth(self.dev)
        resp = c.get("/projects")
        self.assertEqual(resp.status_code, 200)
        ids = [r["id"] for r in resp.data]
        self.assertIn(str(p2.id), ids)
        self.assertNotIn(str(p1.id), ids)

    def test_retrieve_project(self):
        p = _make_project(self.admin, name="Retrieve Me", key="RM")
        c = _auth(self.dev)
        resp = c.get(f"/projects/{p.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["name"], "Retrieve Me")

    def test_retrieve_nonexistent_project_returns_404(self):
        import uuid
        c = _auth(self.dev)
        resp = c.get(f"/projects/{uuid.uuid4()}")
        self.assertEqual(resp.status_code, 404)

    def test_owner_can_update_project(self):
        p = _make_project(self.pm, name="Old Name", key="OLD")
        c = _auth(self.pm)
        resp = c.patch(f"/projects/{p.id}", {"name": "New Name"}, format="json")
        self.assertEqual(resp.status_code, 200)
        p.refresh_from_db()
        self.assertEqual(p.name, "New Name")

    def test_non_owner_pm_cannot_update_others_project(self):
        pm2 = _make_user("pm2@test.com", role=User.PM)
        p = _make_project(self.pm, name="PM1 Proj", key="PM1")
        c = _auth(pm2)
        resp = c.patch(f"/projects/{p.id}", {"name": "Hijacked"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_developer_cannot_update_project(self):
        p = _make_project(self.admin, name="Owned", key="OWN")
        c = _auth(self.dev)
        resp = c.patch(f"/projects/{p.id}", {"name": "Hacked"}, format="json")
        self.assertEqual(resp.status_code, 403)

    def test_archive_project(self):
        p = _make_project(self.pm, name="Archive Me", key="ARC")
        c = _auth(self.pm)
        resp = c.patch(f"/projects/{p.id}", {"is_archived": True}, format="json")
        self.assertEqual(resp.status_code, 200)
        p.refresh_from_db()
        self.assertTrue(p.is_archived)

    def test_archived_projects_filtered_by_default(self):
        p = _make_project(self.admin, name="Archived", key="ARX")
        p.is_archived = True
        p.save()
        c = _auth(self.admin)
        resp = c.get("/projects")
        ids = [r["id"] for r in resp.data]
        self.assertNotIn(str(p.id), ids)

    def test_unauthenticated_cannot_list_projects(self):
        resp = APIClient().get("/projects")
        self.assertEqual(resp.status_code, 401)


class ProjectMemberTests(TestCase):
    def setUp(self):
        self.admin = _make_user("admin@test.com", role=User.ADMIN)
        self.pm = _make_user("pm@test.com", role=User.PM)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.pm, key="MBR")
        ProjectMember.objects.get_or_create(project=self.project, user=self.pm)
        self.pm_client = _auth(self.pm)
        self.dev_client = _auth(self.dev)

    def test_list_members(self):
        resp = self.pm_client.get(f"/projects/{self.project.id}/members")
        self.assertEqual(resp.status_code, 200)

    def test_add_member(self):
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/members/add",
            {"userId": str(self.dev.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(ProjectMember.objects.filter(project=self.project, user=self.dev).exists())

    def test_add_member_idempotent(self):
        ProjectMember.objects.get_or_create(project=self.project, user=self.dev)
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/members/add",
            {"userId": str(self.dev.id)},
            format="json",
        )
        self.assertIn(resp.status_code, [200, 400])
        self.assertEqual(ProjectMember.objects.filter(project=self.project, user=self.dev).count(), 1)

    def test_remove_member(self):
        ProjectMember.objects.get_or_create(project=self.project, user=self.dev)
        resp = self.pm_client.delete(f"/projects/{self.project.id}/members/{self.dev.id}")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(ProjectMember.objects.filter(project=self.project, user=self.dev).exists())

    def test_developer_cannot_add_member(self):
        ProjectMember.objects.get_or_create(project=self.project, user=self.dev)
        new_user = _make_user("newbie@test.com")
        resp = self.dev_client.post(
            f"/projects/{self.project.id}/members/add",
            {"userId": str(new_user.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)


class SprintTests(TestCase):
    def setUp(self):
        self.pm = _make_user("pm@test.com", role=User.PM)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.project = _make_project(self.pm, key="SPR")
        self.pm_client = _auth(self.pm)
        self.dev_client = _auth(self.dev)

    def test_create_sprint(self):
        resp = self.pm_client.post(
            f"/projects/{self.project.id}/sprints",
            {"name": "Sprint 1", "goal": "Ship it", "status": Sprint.PLANNED},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(Sprint.objects.filter(project=self.project, name="Sprint 1").exists())

    def test_developer_cannot_create_sprint(self):
        resp = self.dev_client.post(
            f"/projects/{self.project.id}/sprints",
            {"name": "Sprint X", "status": Sprint.PLANNED},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_list_sprints(self):
        Sprint.objects.create(project=self.project, name="Sprint 1", status=Sprint.PLANNED)
        Sprint.objects.create(project=self.project, name="Sprint 2", status=Sprint.ACTIVE)
        resp = self.pm_client.get(f"/projects/{self.project.id}/sprints")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_get_sprint_detail(self):
        sprint = Sprint.objects.create(project=self.project, name="Sprint 1", status=Sprint.PLANNED)
        resp = self.pm_client.get(f"/sprints/{sprint.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["name"], "Sprint 1")

    def test_update_sprint(self):
        sprint = Sprint.objects.create(project=self.project, name="Sprint 1", status=Sprint.PLANNED)
        resp = self.pm_client.patch(f"/sprints/{sprint.id}", {"name": "Sprint One"}, format="json")
        self.assertEqual(resp.status_code, 200)
        sprint.refresh_from_db()
        self.assertEqual(sprint.name, "Sprint One")

    def test_activate_sprint(self):
        sprint = Sprint.objects.create(project=self.project, name="Sprint 1", status=Sprint.PLANNED)
        resp = self.pm_client.patch(f"/sprints/{sprint.id}", {"status": Sprint.ACTIVE}, format="json")
        self.assertEqual(resp.status_code, 200)
        sprint.refresh_from_db()
        self.assertEqual(sprint.status, Sprint.ACTIVE)

    def test_active_sprint_endpoint(self):
        Sprint.objects.create(project=self.project, name="Active", status=Sprint.ACTIVE)
        resp = self.pm_client.get(f"/projects/{self.project.id}/active-sprint")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["sprint"]["status"], Sprint.ACTIVE)

    def test_active_sprint_returns_404_when_none(self):
        Sprint.objects.create(project=self.project, name="Planned", status=Sprint.PLANNED)
        resp = self.pm_client.get(f"/projects/{self.project.id}/active-sprint")
        self.assertEqual(resp.status_code, 404)

    def test_delete_sprint(self):
        sprint = Sprint.objects.create(project=self.project, name="Sprint 1", status=Sprint.PLANNED)
        resp = self.pm_client.delete(f"/sprints/{sprint.id}")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Sprint.objects.filter(id=sprint.id).exists())
