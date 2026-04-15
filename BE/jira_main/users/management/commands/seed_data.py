"""
Management command to seed the database with dummy data for testing.

Usage:
    python manage.py seed_data           # seed (skips if data exists)
    python manage.py seed_data --clear   # wipe everything then reseed
"""

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Seed the database with dummy data covering all edge cases"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear all existing seed data before re-seeding",
        )

    def handle(self, *args, **options):
        if options["clear"]:
            self._clear()

        with transaction.atomic():
            users = self._create_users()
            projects = self._create_projects(users)
            self._create_members(projects, users)
            labels = self._create_labels(projects)
            sprints = self._create_sprints(projects)
            issues = self._create_issues(projects, sprints, users, labels)
            wiki = self._create_wiki(projects, users)
            self._create_ticket_links(issues, wiki, users)

        self._print_summary(users)

    # ------------------------------------------------------------------
    # Clear
    # ------------------------------------------------------------------

    def _clear(self):
        from issues.models import Issue, Label
        from projects.models import Project, ProjectMember, Sprint
        from users.models import User
        from wiki.models import TicketPageLink, WikiPage, WikiSpace

        self.stdout.write("Clearing existing data...")
        TicketPageLink.objects.all().delete()
        WikiPage.objects.all().delete()
        WikiSpace.objects.all().delete()
        Issue.objects.all().delete()
        Label.objects.all().delete()
        Sprint.objects.all().delete()
        ProjectMember.objects.all().delete()
        Project.objects.all().delete()
        User.objects.all().delete()
        self.stdout.write(self.style.WARNING("All data cleared."))

    # ------------------------------------------------------------------
    # Users  (7 users covering all 4 roles)
    # ------------------------------------------------------------------

    def _create_users(self):
        from users.models import User

        self.stdout.write("Creating users...")

        def make(email, first, last, role):
            if User.objects.filter(email=email).exists():
                return User.objects.get(email=email)
            u = User(
                email=email,
                username=email,
                first_name=first,
                last_name=last,
                role=role,
            )
            u.set_password("Test1234!")
            u.save()
            return u

        return {
            "admin":   make("admin@brainboard.com",   "Alice",   "Admin",   "admin"),
            "pm1":     make("pm1@brainboard.com",     "Bob",     "Manager", "pm"),
            "pm2":     make("pm2@brainboard.com",     "Carol",   "Lead",    "pm"),
            "dev1":    make("dev1@brainboard.com",    "Dave",    "Coder",   "developer"),
            "dev2":    make("dev2@brainboard.com",    "Eve",     "Builder", "developer"),
            "dev3":    make("dev3@brainboard.com",    "Frank",   "Hacker",  "developer"),
            "viewer1": make("viewer1@brainboard.com", "Grace",   "Watcher", "viewer"),
        }

    # ------------------------------------------------------------------
    # Projects  (3 projects with different states)
    # ------------------------------------------------------------------

    def _create_projects(self, u):
        from projects.models import Project

        self.stdout.write("Creating projects...")

        def make(name, desc, owner):
            p, _ = Project.objects.get_or_create(
                name=name,
                defaults={"description": desc, "owner": owner},
            )
            return p

        return {
            # Active sprint → normal board flow
            "alpha": make(
                "Alpha Platform",
                "Core product platform — main feature delivery project.",
                u["pm1"],
            ),
            # Active sprint → second project
            "beta": make(
                "Beta Dashboard",
                "Analytics dashboard for internal reporting.",
                u["pm2"],
            ),
            # No active sprint → tests Option A block on ticket creation
            "gamma": make(
                "Gamma API",
                "Internal REST API gateway. Sprint not started yet.",
                u["admin"],
            ),
        }

    # ------------------------------------------------------------------
    # Project Members
    # ------------------------------------------------------------------

    def _create_members(self, projects, users):
        from projects.models import ProjectMember

        self.stdout.write("Adding project members...")

        def add(project, user):
            ProjectMember.objects.get_or_create(project=project, user=user)

        # Alpha: pm1 owns, dev1 + dev2 + viewer1 are members
        add(projects["alpha"], users["dev1"])
        add(projects["alpha"], users["dev2"])
        add(projects["alpha"], users["viewer1"])

        # Beta: pm2 owns, dev2 + dev3 are members
        add(projects["beta"], users["dev2"])
        add(projects["beta"], users["dev3"])

        # Gamma: admin owns, dev1 + dev3 are members
        add(projects["gamma"], users["dev1"])
        add(projects["gamma"], users["dev3"])

    # ------------------------------------------------------------------
    # Labels
    # ------------------------------------------------------------------

    def _create_labels(self, projects):
        from issues.models import Label

        self.stdout.write("Creating labels...")

        def make(name, color, project):
            l, _ = Label.objects.get_or_create(
                name=name, project=project, defaults={"color": color}
            )
            return l

        alpha_bug   = make("Bug",           "#E53E3E", projects["alpha"])
        alpha_feat  = make("Feature",       "#3182CE", projects["alpha"])
        alpha_enhnc = make("Enhancement",   "#805AD5", projects["alpha"])
        alpha_docs  = make("Documentation", "#38A169", projects["alpha"])

        beta_bug    = make("Bug",     "#E53E3E", projects["beta"])
        beta_feat   = make("Feature", "#3182CE", projects["beta"])
        beta_urg    = make("Urgent",  "#DD6B20", projects["beta"])

        gamma_bug   = make("Bug",     "#E53E3E", projects["gamma"])
        gamma_feat  = make("Feature", "#3182CE", projects["gamma"])
        gamma_api   = make("API",     "#D69E2E", projects["gamma"])

        return {
            "alpha": {
                "bug": alpha_bug, "feat": alpha_feat,
                "enhnc": alpha_enhnc, "docs": alpha_docs,
            },
            "beta": {
                "bug": beta_bug, "feat": beta_feat, "urg": beta_urg,
            },
            "gamma": {
                "bug": gamma_bug, "feat": gamma_feat, "api": gamma_api,
            },
        }

    # ------------------------------------------------------------------
    # Sprints
    # ------------------------------------------------------------------

    def _create_sprints(self, projects):
        from projects.models import Sprint

        self.stdout.write("Creating sprints...")

        def make(name, goal, status, project):
            s, _ = Sprint.objects.get_or_create(
                name=name, project=project,
                defaults={"goal": goal, "status": status},
            )
            return s

        # Alpha: 1 completed (history) + 1 active (current board)
        alpha_s1 = make(
            "Alpha Sprint 1", "Bootstrap core models and auth",
            Sprint.COMPLETED, projects["alpha"],
        )
        alpha_s2 = make(
            "Alpha Sprint 2", "Deliver user-facing project board",
            Sprint.ACTIVE, projects["alpha"],
        )

        # Beta: 1 active
        beta_s1 = make(
            "Beta Sprint 1", "Build dashboard widgets",
            Sprint.ACTIVE, projects["beta"],
        )

        # Gamma: 1 planned only — no active sprint (tests Option A block)
        gamma_s1 = make(
            "Gamma Sprint 1", "Design API gateway routes",
            Sprint.PLANNED, projects["gamma"],
        )

        return {
            "alpha_s1": alpha_s1,
            "alpha_s2": alpha_s2,
            "beta_s1":  beta_s1,
            "gamma_s1": gamma_s1,
        }

    # ------------------------------------------------------------------
    # Issues / Tickets
    # ------------------------------------------------------------------

    def _create_issues(self, projects, sprints, users, labels):
        from issues.models import Issue

        self.stdout.write("Creating issues...")

        created = {}

        def make(key, title, desc, status, priority, project, sprint,
                 assignee, reporter, story_points=None, label_list=None):
            i, _ = Issue.objects.get_or_create(
                title=title, project=project,
                defaults={
                    "description": desc,
                    "status":       status,
                    "priority":     priority,
                    "sprint":       sprint,
                    "assignee":     assignee,
                    "reporter":     reporter,
                    "story_points": story_points,
                },
            )
            if label_list:
                i.labels.set(label_list)
            created[key] = i
            return i

        al = labels["alpha"]
        be = labels["beta"]
        ga = labels["gamma"]
        p  = projects
        s  = sprints
        u  = users

        # ── Alpha Sprint 1 (COMPLETED) — historical done tickets ──────────
        make("a1_t1", "Set up Django project structure",
             "Initialise Django, DRF, JWT, CORS.", Issue.DONE, Issue.HIGH,
             p["alpha"], s["alpha_s1"], u["dev1"], u["pm1"], 3, [al["feat"]])

        make("a1_t2", "Create custom User model",
             "AbstractUser with role field.", Issue.DONE, Issue.CRITICAL,
             p["alpha"], s["alpha_s1"], u["dev1"], u["pm1"], 5, [al["feat"]])

        make("a1_t3", "Write auth endpoints (login/logout)",
             "JWT login and client-side logout.", Issue.DONE, Issue.HIGH,
             p["alpha"], s["alpha_s1"], u["dev2"], u["pm1"], 3, [al["feat"]])

        # ── Alpha Sprint 2 (ACTIVE) — all statuses + priorities ──────────
        make("a2_t1", "Build project list API",
             "Filter projects by membership for non-admin users.", Issue.TODO, Issue.HIGH,
             p["alpha"], s["alpha_s2"], u["dev1"], u["pm1"], 3, [al["feat"]])

        make("a2_t2", "Add sprint start/end logic",
             "Enforce one active sprint; move unfinished tickets to backlog on end.",
             Issue.IN_PROGRESS, Issue.CRITICAL,
             p["alpha"], s["alpha_s2"], u["dev2"], u["pm1"], 8, [al["feat"], al["enhnc"]])

        make("a2_t3", "Fix assignee null bug in IssueUpdateSerializer",
             "Sending assigneeId: null should unassign the ticket.",
             Issue.REVIEW, Issue.MEDIUM,
             p["alpha"], s["alpha_s2"], u["dev1"], u["dev2"], 2, [al["bug"]])

        make("a2_t4", "Write API documentation",
             "Document all endpoints with request/response examples.",
             Issue.DONE, Issue.LOW,
             p["alpha"], s["alpha_s2"], u["dev2"], u["pm1"], 2, [al["docs"]])

        make("a2_t5", "Implement wiki version history",
             "Save a WikiPageVersion snapshot on every PATCH.",
             Issue.IN_PROGRESS, Issue.HIGH,
             p["alpha"], s["alpha_s2"], u["dev1"], u["pm1"], 5, [al["feat"]])

        make("a2_t6", "Critical: login returns 500 on inactive user",
             "authenticate() returns None but LoginSerializer raises 500.",
             Issue.TODO, Issue.CRITICAL,
             p["alpha"], s["alpha_s2"], None, u["pm1"], None, [al["bug"]])  # unassigned

        make("a2_t7", "Refactor permission classes across all views",
             "Replace inline if-checks with permission_classes.",
             Issue.REVIEW, Issue.MEDIUM,
             p["alpha"], s["alpha_s2"], u["dev2"], u["dev2"], 3, [al["enhnc"]])

        # Alpha Backlog — tickets with sprint=None (leftover from sprint 1 or new)
        make("a_bl1", "Add pagination to /users endpoint",
             "Large orgs may have hundreds of users.", Issue.TODO, Issue.LOW,
             p["alpha"], None, None, u["pm1"], None, [al["enhnc"]])

        make("a_bl2", "Rate limiting on /auth/login",
             "Prevent brute force attacks.", Issue.TODO, Issue.HIGH,
             p["alpha"], None, None, u["pm1"], None, [al["feat"], al["bug"]])

        # ── Beta Sprint 1 (ACTIVE) ─────────────────────────────────────
        make("b1_t1", "Design dashboard layout",
             "Wireframes and component breakdown.", Issue.DONE, Issue.HIGH,
             p["beta"], s["beta_s1"], u["dev3"], u["pm2"], 3, [be["feat"]])

        make("b1_t2", "Implement chart widgets",
             "Bar, line, and pie charts using chart.js.", Issue.IN_PROGRESS, Issue.HIGH,
             p["beta"], s["beta_s1"], u["dev2"], u["pm2"], 5, [be["feat"]])

        make("b1_t3", "Fix broken date filter on reports",
             "Date range filter returns wrong results after midnight UTC.",
             Issue.TODO, Issue.CRITICAL,
             p["beta"], s["beta_s1"], u["dev3"], u["dev2"], 2, [be["bug"], be["urg"]])

        make("b1_t4", "Add export to CSV feature",
             "Allow users to download report data as CSV.",
             Issue.TODO, Issue.MEDIUM,
             p["beta"], s["beta_s1"], None, u["pm2"], 3, [be["feat"]])  # unassigned

        make("b1_t5", "Performance: dashboard loads slowly with large datasets",
             "Query optimisation needed for reports with >10k rows.",
             Issue.REVIEW, Issue.HIGH,
             p["beta"], s["beta_s1"], u["dev2"], u["dev3"], 5, [be["urg"]])

        # Beta Backlog
        make("b_bl1", "Dark mode support",
             "Add theme toggle to dashboard.", Issue.TODO, Issue.LOW,
             p["beta"], None, None, u["pm2"], None, [be["feat"]])

        # ── Gamma — NO active sprint (tests Option A block) ───────────
        # These sit in the backlog; sprint=None
        make("g_bl1", "Design API gateway routes",
             "Define all upstream service mappings.", Issue.TODO, Issue.HIGH,
             p["gamma"], None, u["dev1"], u["admin"], 5, [ga["api"], ga["feat"]])

        make("g_bl2", "Add request rate limiting to gateway",
             "Implement token bucket per client IP.", Issue.TODO, Issue.MEDIUM,
             p["gamma"], None, None, u["admin"], 3, [ga["api"]])

        make("g_bl3", "Gateway returns 502 on service timeout",
             "Upstream timeout not propagated correctly.",
             Issue.IN_PROGRESS, Issue.CRITICAL,
             p["gamma"], None, u["dev3"], u["dev1"], 2, [ga["bug"]])

        return created

    # ------------------------------------------------------------------
    # Wiki
    # ------------------------------------------------------------------

    def _create_wiki(self, projects, users):
        from wiki.models import WikiPage, WikiPageVersion, WikiSpace

        self.stdout.write("Creating wiki pages...")

        pages = {}

        def make_space(name, desc, project, created_by):
            sp, _ = WikiSpace.objects.get_or_create(
                name=name, project=project,
                defaults={"description": desc, "created_by": created_by},
            )
            return sp

        def make_page(key, title, content, project, space, parent, created_by):
            pg, created = WikiPage.objects.get_or_create(
                title=title, project=project,
                defaults={
                    "content":    content,
                    "space":      space,
                    "parent":     parent,
                    "created_by": created_by,
                    "updated_by": created_by,
                },
            )
            if created:
                WikiPageVersion.objects.create(
                    page=pg, title=pg.title, content=pg.content,
                    version_number=1, created_by=created_by,
                )
            pages[key] = pg
            return pg

        # ── Alpha wiki ──────────────────────────────────────────────
        alpha_eng = make_space(
            "Engineering", "Technical docs for Alpha Platform",
            projects["alpha"], users["pm1"],
        )

        arch = make_page(
            "alpha_arch",
            "Architecture Overview",
            "# Architecture Overview\n\nAlpha Platform is a Django + DRF monolith with a separate FastAPI DS layer.\n\n## Components\n- **Backend**: Django 5, DRF, SimpleJWT, PostgreSQL\n- **DS Layer**: FastAPI, pgvector (semantic search)\n- **Frontend**: React + TypeScript",
            projects["alpha"], alpha_eng, None, users["pm1"],
        )

        make_page(
            "alpha_db",
            "Database Schema",
            "# Database Schema\n\nAll PKs are UUID. Key tables:\n- `users` — custom AbstractUser\n- `projects`, `project_members`, `sprints`\n- `issues`, `labels`\n- `wiki_pages`, `wiki_page_versions`",
            projects["alpha"], alpha_eng, arch, users["dev1"],
        )

        make_page(
            "alpha_api",
            "API Design",
            "# API Design\n\n## Auth\n- `POST /auth/login`\n- `POST /auth/logout`\n- `GET/PATCH /auth/me`\n\n## Projects\n- `GET /projects` — filtered by membership\n- `POST /projects/create`\n\n## Sprints\n- `GET /projects/:id/active-sprint`",
            projects["alpha"], alpha_eng, arch, users["dev1"],
        )

        make_page(
            "alpha_onboard",
            "Onboarding Guide",
            "# Developer Onboarding\n\n1. Clone the repo\n2. Activate venv: `hack_env\\Scripts\\activate`\n3. Run migrations: `python manage.py migrate`\n4. Seed data: `python manage.py seed_data`\n5. Start server: `python manage.py runserver`\n\nDefault admin: `admin@brainboard.com` / `Test1234!`",
            projects["alpha"], alpha_eng, None, users["pm1"],
        )

        # ── Beta wiki ───────────────────────────────────────────────
        beta_prod = make_space(
            "Product", "Product docs for Beta Dashboard",
            projects["beta"], users["pm2"],
        )

        make_page(
            "beta_specs",
            "Feature Specifications",
            "# Feature Specifications\n\n## Dashboard Widgets\n- Chart widgets: bar, line, pie\n- Date range filter\n- CSV export\n\n## Permissions\n- All roles can view dashboards\n- Only admin/pm can configure widgets",
            projects["beta"], beta_prod, None, users["pm2"],
        )

        make_page(
            "beta_release",
            "Release Notes",
            "# Release Notes\n\n## v0.1.0 (Sprint 1)\n- Initial dashboard layout\n- Chart widget foundation\n- Date filter (bugfix pending)\n\n## Upcoming\n- CSV export\n- Dark mode",
            projects["beta"], beta_prod, None, users["pm2"],
        )

        # ── Gamma wiki ──────────────────────────────────────────────
        gamma_eng = make_space(
            "Engineering", "API Gateway technical docs",
            projects["gamma"], users["admin"],
        )

        make_page(
            "gamma_routes",
            "Gateway Route Design",
            "# Gateway Route Design\n\nAll upstream services are mapped via the gateway.\n\n## Routes\n- `/api/v1/users/**` → User Service\n- `/api/v1/projects/**` → Project Service\n\n## Auth\nJWT validation at the gateway layer.",
            projects["gamma"], gamma_eng, None, users["admin"],
        )

        return pages

    # ------------------------------------------------------------------
    # Ticket ↔ Wiki Page Links
    # ------------------------------------------------------------------

    def _create_ticket_links(self, issues, wiki, users):
        from wiki.models import TicketPageLink

        self.stdout.write("Creating ticket-wiki links...")

        def link(issue_key, page_key, linked_by):
            if issue_key in issues and page_key in wiki:
                TicketPageLink.objects.get_or_create(
                    issue=issues[issue_key],
                    wiki_page=wiki[page_key],
                    defaults={"linked_by": linked_by},
                )

        link("a2_t2", "alpha_arch",    users["dev2"])   # Sprint logic → Architecture
        link("a2_t5", "alpha_api",     users["dev1"])   # Wiki versioning → API Design
        link("a2_t7", "alpha_onboard", users["dev2"])   # Refactor → Onboarding
        link("b1_t3", "beta_release",  users["dev3"])   # Date filter bug → Release notes
        link("b1_t4", "beta_specs",    users["pm2"])    # CSV export → Feature specs
        link("g_bl1", "gamma_routes",  users["dev1"])   # Gateway routes → Route Design doc

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------

    def _print_summary(self, users):
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write(self.style.SUCCESS("Seed data created successfully!"))
        self.stdout.write("=" * 60)
        self.stdout.write("\nTest credentials (all passwords: Test1234!)\n")
        creds = [
            ("admin@brainboard.com",   "admin",     "Sees all projects"),
            ("pm1@brainboard.com",     "pm",        "Owns Alpha Platform"),
            ("pm2@brainboard.com",     "pm",        "Owns Beta Dashboard"),
            ("dev1@brainboard.com",    "developer", "Member: Alpha, Gamma"),
            ("dev2@brainboard.com",    "developer", "Member: Alpha, Beta"),
            ("dev3@brainboard.com",    "developer", "Member: Beta, Gamma"),
            ("viewer1@brainboard.com", "viewer",    "Member: Alpha only"),
        ]
        for email, role, note in creds:
            self.stdout.write(f"  {email:<30} [{role:<9}]  {note}")
        self.stdout.write("\nProjects:")
        self.stdout.write("  Alpha Platform  — Sprint 2 ACTIVE  (sprint history + backlog)")
        self.stdout.write("  Beta Dashboard  — Sprint 1 ACTIVE  (active board)")
        self.stdout.write("  Gamma API       — Sprint 1 PLANNED (no active sprint, ticket creation blocked)")
        self.stdout.write("=" * 60 + "\n")
