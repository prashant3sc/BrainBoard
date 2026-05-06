from rest_framework.test import APIClient
from django.test import TestCase

from users.models import User


def _make_user(email, role=User.DEVELOPER, password="pass1234", first_name="Test"):
    return User.objects.create_user(email=email, password=password, role=role, first_name=first_name)


class AuthTests(TestCase):
    def setUp(self):
        self.user = _make_user("user@test.com", password="pass1234")
        self.client = APIClient()

    def test_login_success(self):
        resp = self.client.post("/auth/login", {"email": "user@test.com", "password": "pass1234"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("token", resp.data)
        self.assertIn("user", resp.data)
        self.assertEqual(resp.data["user"]["email"], "user@test.com")

    def test_login_wrong_password(self):
        resp = self.client.post("/auth/login", {"email": "user@test.com", "password": "wrong"}, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_login_unknown_email(self):
        resp = self.client.post("/auth/login", {"email": "nobody@test.com", "password": "pass1234"}, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_login_missing_fields(self):
        resp = self.client.post("/auth/login", {"email": "user@test.com"}, format="json")
        self.assertEqual(resp.status_code, 401)

    def test_logout_requires_auth(self):
        resp = self.client.post("/auth/logout")
        self.assertEqual(resp.status_code, 401)

    def test_logout_authenticated(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/auth/logout")
        self.assertEqual(resp.status_code, 200)


class UserProfileTests(TestCase):
    def setUp(self):
        self.user = _make_user("me@test.com", password="pass1234")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_get_own_profile(self):
        resp = self.client.get("/auth/me")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "me@test.com")
        self.assertEqual(resp.data["role"], User.DEVELOPER)

    def test_profile_unauthenticated(self):
        c = APIClient()
        resp = c.get("/auth/me")
        self.assertEqual(resp.status_code, 401)

    def test_change_password_success(self):
        resp = self.client.patch(
            "/auth/me",
            {"current_password": "pass1234", "new_password": "newpass99"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("newpass99"))

    def test_change_password_wrong_current(self):
        resp = self.client.patch(
            "/auth/me",
            {"current_password": "wrongpass", "new_password": "newpass99"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_change_password_too_short(self):
        resp = self.client.patch(
            "/auth/me",
            {"current_password": "pass1234", "new_password": "short"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class UserListTests(TestCase):
    def setUp(self):
        self.admin = _make_user("admin@test.com", role=User.ADMIN)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.viewer = _make_user("viewer@test.com", role=User.VIEWER)
        self.client = APIClient()
        self.client.force_authenticate(user=self.dev)

    def test_list_users_authenticated(self):
        resp = self.client.get("/users")
        self.assertEqual(resp.status_code, 200)
        emails = [u["email"] for u in resp.data]
        self.assertIn("dev@test.com", emails)
        self.assertIn("admin@test.com", emails)

    def test_list_users_unauthenticated(self):
        c = APIClient()
        resp = c.get("/users")
        self.assertEqual(resp.status_code, 401)

    def test_filter_by_role(self):
        resp = self.client.get("/users", {"role": User.VIEWER})
        self.assertEqual(resp.status_code, 200)
        for u in resp.data:
            self.assertEqual(u["role"], User.VIEWER)

    def test_search_by_email(self):
        resp = self.client.get("/users", {"search": "admin"})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(any("admin" in u["email"] for u in resp.data))


class UserManagementTests(TestCase):
    def setUp(self):
        self.admin = _make_user("admin@test.com", role=User.ADMIN)
        self.dev = _make_user("dev@test.com", role=User.DEVELOPER)
        self.admin_client = APIClient()
        self.admin_client.force_authenticate(user=self.admin)
        self.dev_client = APIClient()
        self.dev_client.force_authenticate(user=self.dev)

    def test_admin_can_create_user(self):
        resp = self.admin_client.post(
            "/users/create",
            {
                "email": "new@test.com",
                "first_name": "New",
                "last_name": "User",
                "role": User.DEVELOPER,
                "password": "pass1234",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(email="new@test.com").exists())

    def test_non_admin_cannot_create_user(self):
        resp = self.dev_client.post(
            "/users/create",
            {"email": "hacker@test.com", "first_name": "H", "role": User.DEVELOPER, "password": "pass1234"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)

    def test_duplicate_email_rejected(self):
        resp = self.admin_client.post(
            "/users/create",
            {"email": "dev@test.com", "first_name": "Dup", "role": User.DEVELOPER, "password": "pass1234"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_admin_can_get_user_by_id(self):
        resp = self.admin_client.get(f"/users/{self.dev.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "dev@test.com")

    def test_non_admin_cannot_get_user_by_id(self):
        resp = self.dev_client.get(f"/users/{self.admin.id}")
        self.assertEqual(resp.status_code, 403)

    def test_get_nonexistent_user_returns_404(self):
        import uuid
        resp = self.admin_client.get(f"/users/{uuid.uuid4()}")
        self.assertEqual(resp.status_code, 404)

    def test_admin_can_update_role(self):
        resp = self.admin_client.patch(f"/users/{self.dev.id}", {"role": User.PM}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.dev.refresh_from_db()
        self.assertEqual(self.dev.role, User.PM)

    def test_admin_can_delete_other_user(self):
        resp = self.admin_client.delete(f"/users/{self.dev.id}")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(User.objects.filter(id=self.dev.id).exists())

    def test_admin_cannot_delete_own_account(self):
        resp = self.admin_client.delete(f"/users/{self.admin.id}")
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())

    def test_user_role_properties(self):
        admin = _make_user("a2@test.com", role=User.ADMIN)
        pm = _make_user("pm@test.com", role=User.PM)
        dev = _make_user("d2@test.com", role=User.DEVELOPER)
        viewer = _make_user("v2@test.com", role=User.VIEWER)

        self.assertTrue(admin.is_org_admin)
        self.assertFalse(pm.is_org_admin)
        self.assertTrue(pm.can_manage_projects)
        self.assertFalse(dev.can_manage_projects)
        self.assertTrue(dev.can_create_issues)
        self.assertFalse(viewer.can_create_issues)
        self.assertTrue(dev.can_write_wiki)
        self.assertFalse(viewer.can_write_wiki)
        self.assertTrue(pm.can_plan_sprints)
        self.assertFalse(dev.can_plan_sprints)
