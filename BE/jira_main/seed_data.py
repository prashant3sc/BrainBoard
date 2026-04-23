"""
BrainBoard full seed script.

Seeds PostgreSQL with:
  - 10 users (admin, pm, developer, tester roles)
  - 5 projects with project members
  - 5+ sprints per project (1 active, rest planned/completed)
  - 25+ issues per project with labels (frontend, backend, tester, ai engineer)
  - 3 wiki spaces per project, each with 1 parent page + 2 sub-pages

Then syncs all user profiles + issue context to ChromaDB via the AI layer.

Usage:
  cd BE
  source hack_env/Scripts/activate      # Windows
  cd jira_main
  python seed_data.py
"""

import os
import sys
import django
import requests
from datetime import date, timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "jira_main.settings")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.contrib.auth import get_user_model
from issues.models import Issue, Label
from projects.models import Project, ProjectMember, Sprint
from wiki.models import WikiSpace, WikiPage

User = get_user_model()

# ── ChromaDB / AI layer config ────────────────────────────────────────────────
AI_BASE_URL = os.environ.get("AI_SERVICE_URL", "http://localhost:8001")
SYNC_TO_CHROMA = True  # Set False to skip ChromaDB sync

# ── Helpers ───────────────────────────────────────────────────────────────────

def p(msg): print(f"  {msg}")

def sprint_dates(offset_weeks: int, length_weeks: int = 2):
    start = date.today() + timedelta(weeks=offset_weeks)
    return start, start + timedelta(weeks=length_weeks)

# ── 1. USERS ──────────────────────────────────────────────────────────────────

USERS_DATA = [
    # (first, last, email, role, password)
    ("Prashant",  "Poonia",     "prashant@brainboard.dev",  "admin",     "Admin@123"),
    ("Harsh",     "Malik",      "harsh@brainboard.dev",     "pm",        "Admin@123"),
    ("Malaya",    "Panda",      "malaya@brainboard.dev",    "developer", "Admin@123"),
    ("Naman",     "Mishra",     "naman@brainboard.dev",     "developer", "Admin@123"),
    ("Bunesh",    "Authenkar",  "bunesh@brainboard.dev",    "developer", "Admin@123"),
    ("Vishal",    "Jadhav",     "vishal@brainboard.dev",    "developer", "Admin@123"),
    ("Sneha",     "Sharma",     "sneha@brainboard.dev",     "developer", "Admin@123"),
    ("Rohit",     "Verma",      "rohit@brainboard.dev",     "developer", "Admin@123"),
    ("Anjali",    "Singh",      "anjali@brainboard.dev",    "pm",        "Admin@123"),
    ("Kiran",     "Desai",      "kiran@brainboard.dev",     "viewer",    "Admin@123"),
]

# Maps to labels + ChromaDB roles
USER_EXPERTISE = {
    "prashant@brainboard.dev": {"label": "backend",     "chroma_role": "Backend Engineer",    "skills": ["Django", "FastAPI", "PostgreSQL", "REST API", "Python"]},
    "harsh@brainboard.dev":    {"label": "backend",     "chroma_role": "Project Manager",     "skills": ["Project Management", "Agile", "Scrum", "Sprint Planning", "Stakeholder Management"]},
    "malaya@brainboard.dev":   {"label": "ai engineer", "chroma_role": "Data Scientist",      "skills": ["Machine Learning", "Python", "Data Analysis", "Model Training", "SQL", "Forecasting"]},
    "naman@brainboard.dev":    {"label": "backend",     "chroma_role": "MLOps Engineer",      "skills": ["MLOps", "MLflow", "Docker", "CI/CD", "Model Deployment", "FastAPI", "Python"]},
    "bunesh@brainboard.dev":   {"label": "ai engineer", "chroma_role": "Data Scientist",      "skills": ["Deep Learning", "NLP", "PyTorch", "Statistics", "Model Training", "Research"]},
    "vishal@brainboard.dev":   {"label": "frontend",    "chroma_role": "Frontend Developer",  "skills": ["React", "TypeScript", "TailwindCSS", "JavaScript", "Vite", "UI/UX"]},
    "sneha@brainboard.dev":    {"label": "frontend",    "chroma_role": "Frontend Developer",  "skills": ["React", "CSS", "JavaScript", "Figma", "Accessibility", "Testing"]},
    "rohit@brainboard.dev":    {"label": "tester",      "chroma_role": "QA Engineer",         "skills": ["QA Testing", "Selenium", "Pytest", "Test Automation", "Bug Reporting", "API Testing"]},
    "anjali@brainboard.dev":   {"label": "backend",     "chroma_role": "Project Manager",     "skills": ["Project Management", "Agile", "Risk Management", "Documentation", "Scrum"]},
    "kiran@brainboard.dev":    {"label": "tester",      "chroma_role": "QA Engineer",         "skills": ["Manual Testing", "Test Cases", "UAT", "Bug Reporting", "Documentation"]},
}

print("\n=== Creating Users ===")
users = {}
for first, last, email, role, pwd in USERS_DATA:
    user, created = User.objects.get_or_create(
        email=email,
        defaults={
            "username": email,
            "first_name": first,
            "last_name": last,
            "role": role,
        }
    )
    if created:
        user.set_password(pwd)
        user.save()
        p(f"Created: {first} {last} ({role})")
    else:
        p(f"Exists:  {first} {last}")
    users[email] = user

admin_user = users["prashant@brainboard.dev"]
pm1        = users["harsh@brainboard.dev"]
pm2        = users["anjali@brainboard.dev"]
devs       = [users[e] for e in ["malaya@brainboard.dev", "naman@brainboard.dev",
                                   "bunesh@brainboard.dev", "vishal@brainboard.dev",
                                   "sneha@brainboard.dev", "rohit@brainboard.dev"]]

# ── 2. PROJECTS ───────────────────────────────────────────────────────────────

PROJECTS_DATA = [
    ("BrainBoard Core",       "Main Jira-like project management platform built with Django + React.", admin_user),
    ("AI Analytics Engine",   "ML pipeline for sprint velocity forecasting and smart ticket routing.", pm1),
    ("DataVault",             "Secure data lake and ETL pipeline for cross-team analytics.",          pm2),
    ("MobileApp",             "React Native mobile client for BrainBoard on iOS and Android.",       pm1),
    ("InfraOps",              "DevOps and infrastructure automation: CI/CD, K8s, monitoring.",       admin_user),
]

print("\n=== Creating Projects ===")
projects = []
for name, desc, owner in PROJECTS_DATA:
    proj, created = Project.objects.get_or_create(
        name=name,
        defaults={"description": desc, "owner": owner}
    )
    p(f"{'Created' if created else 'Exists '}: {name}")
    projects.append(proj)

# Add all users as members of every project
print("\n=== Adding Project Members ===")
for proj in projects:
    for user in users.values():
        ProjectMember.objects.get_or_create(project=proj, user=user)
    p(f"{proj.name}: {len(users)} members")

# ── 3. LABELS (per project) ───────────────────────────────────────────────────

LABEL_DEFS = [
    ("frontend",    "#3B82F6"),
    ("backend",     "#10B981"),
    ("tester",      "#F59E0B"),
    ("ai engineer", "#8B5CF6"),
    ("devops",      "#EF4444"),
    ("documentation","#6B7280"),
]

print("\n=== Creating Labels ===")
project_labels = {}  # project → {name: Label}
for proj in projects:
    project_labels[proj.id] = {}
    for lname, color in LABEL_DEFS:
        label, _ = Label.objects.get_or_create(name=lname, project=proj, defaults={"color": color})
        project_labels[proj.id][lname] = label
    p(f"{proj.name}: {len(LABEL_DEFS)} labels")

# ── 4. SPRINTS ────────────────────────────────────────────────────────────────

# Each project: 2 completed, 1 active, 3 planned = 6 sprints
def make_sprints(proj):
    sprints = []
    configs = [
        ("Sprint 1", Sprint.COMPLETED, sprint_dates(-8, 2)),
        ("Sprint 2", Sprint.COMPLETED, sprint_dates(-6, 2)),
        ("Sprint 3", Sprint.ACTIVE,    sprint_dates(-4, 2)),
        ("Sprint 4", Sprint.PLANNED,   sprint_dates(0,  2)),
        ("Sprint 5", Sprint.PLANNED,   sprint_dates(2,  2)),
        ("Sprint 6", Sprint.PLANNED,   sprint_dates(4,  2)),
    ]
    for name, status, (start, end) in configs:
        sprint, _ = Sprint.objects.get_or_create(
            project=proj, name=name,
            defaults={"status": status, "start_date": start, "end_date": end,
                      "goal": f"{name} goal for {proj.name}"}
        )
        sprints.append(sprint)
    return sprints

print("\n=== Creating Sprints ===")
project_sprints = {}
for proj in projects:
    sprints = make_sprints(proj)
    project_sprints[proj.id] = sprints
    p(f"{proj.name}: {len(sprints)} sprints")

# ── 5. ISSUES (25+ per project) ───────────────────────────────────────────────

def make_issues(proj, sprints, labels, members):
    all_users = list(members)
    active_sprint  = next(s for s in sprints if s.status == Sprint.ACTIVE)
    completed_sprints = [s for s in sprints if s.status == Sprint.COMPLETED]
    planned_sprint = next(s for s in sprints if s.status == Sprint.PLANNED)

    # (title, description, issue_type, priority, label_names, status, story_pts, assignee_idx)
    issues_spec = [
        # ── Backend tickets ──────────────────────────────────────────────────
        ("Setup Django REST Framework project structure",
         "Initialize Django project with DRF, configure settings, CORS, JWT auth, and PostgreSQL connection.",
         "task", "high", ["backend"], Issue.DONE, 3, 0),

        ("Design and implement User model with roles",
         "Create custom AbstractUser with role field (admin, pm, developer, viewer). Implement UserManager.",
         "task", "high", ["backend"], Issue.DONE, 2, 0),

        ("Build Project CRUD API endpoints",
         "Implement GET /projects, POST /projects/create, PATCH /projects/:id, DELETE /projects/:id.",
         "task", "high", ["backend"], Issue.IN_PROGRESS, 5, 0),

        ("Implement Issue tracking with filters",
         "Build Issue model, serializers, and filter-enabled list/detail views. Support status, priority, sprint, assignee filters.",
         "task", "high", ["backend"], Issue.IN_PROGRESS, 5, 0),

        ("JWT Authentication: login, logout, token refresh",
         "Wire SimpleJWT endpoints. Implement /auth/login and /auth/me. Handle token blacklisting on logout.",
         "task", "medium", ["backend"], Issue.DONE, 3, 0),

        ("Sprint management: start, complete, move tickets",
         "PATCH /sprints/:id to transition status. On completion, move unfinished issues to backlog or next sprint.",
         "task", "medium", ["backend"], Issue.TODO, 4, 0),

        ("Fix N+1 query on issue list endpoint",
         "ProjectIssueListView causes N+1 on assignee and reporter. Add select_related and annotate subtask counts.",
         "bug", "critical", ["backend", "tester"], Issue.IN_PROGRESS, 2, 0),

        ("Add pagination to all list endpoints",
         "DRF list views need cursor-based pagination. Implement reusable pagination class.",
         "task", "medium", ["backend"], Issue.TODO, 3, 0),

        # ── Frontend tickets ──────────────────────────────────────────────────
        ("Setup React + Vite + TypeScript project",
         "Bootstrap FE with Vite, configure TypeScript strict mode, TailwindCSS, React Router v7.",
         "task", "high", ["frontend"], Issue.DONE, 2, 3),

        ("Implement Zustand auth store with JWT",
         "Store access token in localStorage. Implement login, logout, persist auth state across reloads.",
         "task", "high", ["frontend"], Issue.DONE, 3, 3),

        ("Build Kanban board with drag-and-drop",
         "Implement kanban view for sprint issues. Support dragging cards between status columns (todo → in_progress → review → done).",
         "task", "high", ["frontend"], Issue.IN_PROGRESS, 8, 4),

        ("Project dashboard: sprint burndown chart",
         "Display active sprint progress with story points burned vs remaining. Use recharts.",
         "task", "medium", ["frontend"], Issue.TODO, 5, 3),

        ("Issue detail modal: edit, assign, comment",
         "Slide-over panel showing full issue details. Inline editing for title, description, assignee, labels, story points.",
         "task", "high", ["frontend"], Issue.IN_PROGRESS, 5, 4),

        ("Wiki rich text editor with TipTap",
         "Integrate TipTap editor for wiki pages. Support headings, lists, code blocks, inline images.",
         "task", "medium", ["frontend"], Issue.TODO, 4, 3),

        ("Responsive sidebar and navigation",
         "Implement collapsible sidebar with project switcher, sprint nav, wiki link. Mobile breakpoints.",
         "task", "low", ["frontend"], Issue.DONE, 3, 4),

        ("Dark mode support with Tailwind",
         "Add dark mode toggle. Persist preference in localStorage. All components must support dark variant.",
         "task", "low", ["frontend"], Issue.TODO, 3, 3),

        # ── AI / ML tickets ───────────────────────────────────────────────────
        ("Integrate ChromaDB vector store for team RAG",
         "Setup ChromaDB. Implement add_team_member() to embed team profiles. Support similarity_search for task routing.",
         "task", "high", ["ai engineer"], Issue.DONE, 5, 1),

        ("Story point estimation LLM pipeline",
         "Build RAG pipeline: retrieve top-k team members by similarity, pass to GPT-4o-mini with structured JSON output schema.",
         "task", "high", ["ai engineer"], Issue.IN_PROGRESS, 8, 2),

        ("Chatbot endpoint: ticket creation + Q&A",
         "Intent classification: if user asks to create ticket → return jira_summary + jira_description. Else → logical_thinking.",
         "task", "medium", ["ai engineer"], Issue.IN_PROGRESS, 5, 1),

        ("Sync PostgreSQL team data to ChromaDB",
         "BE endpoint to read all users and their workloads from DB, compute capacity, bulk-upload to ChromaDB via AI layer.",
         "task", "high", ["ai engineer", "backend"], Issue.TODO, 5, 0),

        ("AI-powered search: semantic issue retrieval",
         "Replace full-text search with vector similarity search. Embed issue titles and return semantically similar results.",
         "task", "medium", ["ai engineer"], Issue.TODO, 8, 2),

        # ── QA / Testing tickets ──────────────────────────────────────────────
        ("Write API integration tests for auth endpoints",
         "Pytest tests for /auth/login, /auth/me, token refresh, invalid credentials. Use Django test client.",
         "task", "medium", ["tester"], Issue.DONE, 3, 5),

        ("E2E test: create project → sprint → issue flow",
         "Selenium or Playwright E2E test covering full happy path from project creation to closing a sprint.",
         "task", "high", ["tester"], Issue.IN_PROGRESS, 5, 5),

        ("Performance test: kanban board with 200 issues",
         "Load test the kanban board with large sprints. Identify render bottlenecks and API response time degradation.",
         "task", "medium", ["tester"], Issue.TODO, 4, 5),

        ("Bug: label filter not working on issue list",
         "Filtering by label_id on GET /projects/:id/issues returns all issues. Django filter backend misconfiguration.",
         "bug", "high", ["tester", "backend"], Issue.IN_PROGRESS, 2, 5),

        ("Test wiki page versioning and history",
         "Verify that every save creates a WikiPageVersion. Test rollback, version diff display, edge cases.",
         "task", "medium", ["tester"], Issue.TODO, 3, 5),

        # ── DevOps ────────────────────────────────────────────────────────────
        ("Docker Compose multi-service setup",
         "Wire db, be, ai, fe services. Health checks, volume mounts, .env injection. Document startup steps.",
         "task", "high", ["devops", "backend"], Issue.DONE, 4, 0),

        ("CI pipeline: lint, test, build on PR",
         "GitHub Actions workflow: ruff lint, pytest, npm build. Gate PRs on green status.",
         "task", "medium", ["devops"], Issue.TODO, 3, 5),
    ]

    created_issues = []
    sprint_cycle = [completed_sprints[0], completed_sprints[1], active_sprint, planned_sprint, active_sprint]

    for i, (title, desc, itype, priority, lnames, istatus, pts, assignee_idx) in enumerate(issues_spec):
        assignee = all_users[assignee_idx % len(all_users)]
        sprint = sprint_cycle[i % len(sprint_cycle)]

        # Completed sprints → issues must be DONE
        if sprint.status == Sprint.COMPLETED:
            istatus = Issue.DONE
        # Planned sprints → issues must be TODO
        if sprint.status == Sprint.PLANNED:
            istatus = Issue.TODO

        issue, created = Issue.objects.get_or_create(
            title=title,
            project=proj,
            defaults={
                "description": desc,
                "issue_type": itype,
                "priority": priority,
                "status": istatus,
                "story_points": pts,
                "sprint": sprint,
                "assignee": assignee,
                "reporter": all_users[(assignee_idx + 1) % len(all_users)],
            }
        )
        if created:
            for lname in lnames:
                if lname in labels:
                    issue.labels.add(labels[lname])
        created_issues.append(issue)

    return created_issues

print("\n=== Creating Issues ===")
project_issues = {}
for proj in projects:
    all_members = list(users.values())
    issues = make_issues(proj, project_sprints[proj.id], project_labels[proj.id], all_members)
    project_issues[proj.id] = issues
    p(f"{proj.name}: {len(issues)} issues")

# ── 6. WIKI (3 spaces × 1 parent + 2 sub-pages per project) ──────────────────

WIKI_DATA = [
    (
        "Architecture",
        "System design, ADRs, and technical decisions.",
        [
            ("System Overview",
             "# System Overview\n\nBrainBoard is a three-tier application:\n- **Frontend**: React 19 + Vite + TypeScript\n- **Backend**: Django 6 + DRF + JWT\n- **AI Layer**: FastAPI + LangChain + ChromaDB\n- **Database**: PostgreSQL 16\n\n## Design Goals\n- Role-based access control\n- Real-time kanban board\n- AI-powered task estimation",
             [
                ("Frontend Architecture",
                 "# Frontend Architecture\n\n## State Management\nZustand stores: `useAuthStore`, `useProjectStore`, `useIssueStore`.\n\n## API Layer\nAxios instance with JWT interceptor in `src/api/client.ts`. All BE calls go through this client.\n\n## Routing\nReact Router v7 with protected routes. Auth guard redirects to `/login`."),
                ("Backend Architecture",
                 "# Backend Architecture\n\n## Apps\n- `users`: Custom AbstractUser, roles, JWT\n- `projects`: Project, ProjectMember, Sprint\n- `issues`: Issue, Label with filter support\n- `wiki`: WikiSpace, WikiPage, versioning\n- `ai_integration`: Proxy to FastAPI AI layer\n\n## Database\nPostgreSQL with UUID primary keys on all models."),
             ]),
        ]
    ),
    (
        "API Reference",
        "Endpoint documentation for all services.",
        [
            ("REST API Endpoints",
             "# REST API Endpoints\n\n## Auth\n- `POST /auth/login` — returns access + refresh tokens\n- `GET /auth/me` — current user profile\n\n## Projects\n- `GET /projects` — list user projects\n- `POST /projects/create` — create project (admin/pm)\n\n## Issues\n- `GET /projects/:id/issues` — filtered issue list\n- `POST /issues` — create issue\n- `PATCH /issues/:id` — update issue\n\n## AI\n- `POST /ai/sync` — sync team to ChromaDB\n- `POST /ai/analyze-issue/:id` — RAG analysis\n- `POST /ai/chat` — chatbot",
             [
                ("AI Layer API",
                 "# AI Layer API (FastAPI :8001)\n\n## Endpoints\n- `POST /upload-context` — add single team member to ChromaDB\n- `POST /sync-bulk` — bulk sync from Django BE\n- `POST /analyze-task` — RAG story point estimation\n- `POST /chat` — Jira chatbot\n- `GET /health` — health check\n\n## Auth\nAll endpoints require `X-API-Key` header in production."),
                ("Authentication Guide",
                 "# Authentication Guide\n\n## Login Flow\n1. POST `/auth/login` with `{email, password}`\n2. Store `access` token in localStorage\n3. Attach as `Authorization: Bearer <token>` on every request\n\n## Token Refresh\nAccess token expires in 8h. Refresh token valid 7 days.\n\n## Roles\n| Role | Permissions |\n|---|---|\n| admin | Full access |\n| pm | Manage projects, sprints |\n| developer | Create/edit issues |\n| viewer | Read only |"),
             ]),
        ]
    ),
    (
        "Team Processes",
        "Sprint ceremonies, Definition of Done, and team agreements.",
        [
            ("Sprint Process",
             "# Sprint Process\n\n## Sprint Length\nAll sprints are 2 weeks (11 working days, 1 point = 1 day).\n\n## Ceremonies\n- **Planning**: Monday morning, 2h\n- **Daily standup**: 15 min async in Slack\n- **Review**: Last Friday, demo to stakeholders\n- **Retrospective**: Last Friday after review\n\n## Velocity\nTarget: 20–30 story points per sprint per team.",
             [
                ("Definition of Done",
                 "# Definition of Done\n\nA ticket is DONE when:\n- [ ] Code reviewed and approved by 1+ peer\n- [ ] Unit tests written and passing\n- [ ] No regressions in existing tests\n- [ ] Deployed to staging\n- [ ] QA sign-off from tester\n- [ ] Documentation updated if applicable"),
                ("Branching Strategy",
                 "# Branching Strategy\n\n## Flow\n`feature/<ticket-id>-short-name` → PR to `main`\n\n## Rules\n- No direct commits to `main`\n- PR must have green CI before merge\n- Squash merge preferred\n- Delete branch after merge\n\n## Hotfixes\n`hotfix/<description>` → PR to `main` with expedited review."),
             ]),
        ]
    ),
]

print("\n=== Creating Wiki ===")
for proj in projects:
    pm_user = proj.owner
    for space_name, space_desc, pages in WIKI_DATA:
        space, _ = WikiSpace.objects.get_or_create(
            name=space_name, project=proj,
            defaults={"description": space_desc, "created_by": pm_user}
        )
        for page_title, page_content, subpages in pages:
            parent_page, _ = WikiPage.objects.get_or_create(
                title=page_title, project=proj,
                defaults={
                    "content": page_content,
                    "space": space,
                    "parent": None,
                    "created_by": pm_user,
                    "updated_by": pm_user,
                }
            )
            for sub_title, sub_content in subpages:
                WikiPage.objects.get_or_create(
                    title=sub_title, project=proj,
                    defaults={
                        "content": sub_content,
                        "space": space,
                        "parent": parent_page,
                        "created_by": pm_user,
                        "updated_by": pm_user,
                    }
                )
    p(f"{proj.name}: 3 spaces, 3 parent pages, 6 sub-pages")

# ── 7. SYNC TO CHROMADB ───────────────────────────────────────────────────────

if not SYNC_TO_CHROMA:
    print("\nSkipping ChromaDB sync (SYNC_TO_CHROMA=False)")
    print("\n=== Seed complete! ===")
    sys.exit(0)

print("\n=== Syncing to ChromaDB via AI layer ===")

# Build per-user workload from active sprint issues
active_sprint_ids = list(Sprint.objects.filter(status=Sprint.ACTIVE).values_list("id", flat=True))

chroma_members = []
for email, user in users.items():
    expertise = USER_EXPERTISE.get(email, {})

    # Workload = story points of assigned in-progress issues in active sprints
    assigned = Issue.objects.filter(
        assignee=user,
        sprint_id__in=active_sprint_ids
    ).exclude(status=Issue.DONE)

    workload = sum(i.story_points if i.story_points else 1 for i in assigned)

    chroma_members.append({
        "member_name": user.get_full_name() or user.email,
        "role": expertise.get("chroma_role", user.role),
        "skills": expertise.get("skills", ["general"]),
        "total_working_days": 11,
        "current_workload": workload,
    })
    p(f"Prepared: {user.get_full_name()} | role={expertise.get('chroma_role', user.role)} | workload={workload}")

# Also embed a summary of all issues as searchable documents (for semantic search)
# We'll add these as additional documents to ChromaDB directly via the AI layer API
print("\n  Pushing team profiles to ChromaDB ...")
try:
    resp = requests.post(
        f"{AI_BASE_URL}/sync-bulk",
        json={"members": chroma_members},
        timeout=120,
    )
    if resp.status_code == 200:
        data = resp.json()
        p(f"Team sync: {data.get('synced', '?')}/{data.get('total', '?')} members synced")
    else:
        p(f"Team sync failed ({resp.status_code}): {resp.text[:200]}")
except requests.ConnectionError:
    print("\n  [!] Could not reach AI layer at", AI_BASE_URL)
    print("     Start AI server first, then re-run to sync ChromaDB.")

# ── 8. EMBED ISSUE CONTEXT INTO CHROMADB ─────────────────────────────────────
# We push all issues as documents so the RAG can also retrieve relevant past tickets

print("\n  Embedding issue context into ChromaDB ...")
try:
    import chromadb
    from chromadb.utils import embedding_functions

    # Import AI layer paths to use same chroma_db dir
    ai_root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "AI")
    sys.path.insert(0, ai_root)

    from app.config import get_settings as get_ai_settings
    from app.services.rag_pipeline import get_vector_store

    vector_store = get_vector_store()

    issue_docs = []
    issue_ids  = []
    issue_metas = []

    for proj in projects:
        for issue in project_issues[proj.id]:
            label_names = list(issue.labels.values_list("name", flat=True))
            assignee_name = issue.assignee.get_full_name() if issue.assignee else "Unassigned"
            doc_text = (
                f"Project: {proj.name}\n"
                f"Issue: {issue.title}\n"
                f"Type: {issue.issue_type} | Priority: {issue.priority} | Status: {issue.status}\n"
                f"Labels: {', '.join(label_names) if label_names else 'none'}\n"
                f"Story Points: {issue.story_points or 'unestimated'}\n"
                f"Assignee: {assignee_name}\n"
                f"Description: {issue.description[:300]}"
            )
            issue_docs.append(doc_text)
            issue_ids.append(str(issue.id))
            issue_metas.append({
                "type": "issue",
                "project": proj.name,
                "issue_type": issue.issue_type,
                "priority": issue.priority,
                "labels": ",".join(label_names),
                "assignee": assignee_name,
            })

    # Use the LangChain Chroma vector store to add documents
    from langchain_core.documents import Document
    docs = [
        Document(page_content=issue_docs[i], metadata=issue_metas[i])
        for i in range(len(issue_docs))
    ]
    vector_store.add_documents(docs)
    if hasattr(vector_store, "persist"):
        vector_store.persist()

    p(f"Embedded {len(docs)} issues into ChromaDB collection '{get_ai_settings().chroma_collection}'")

except ImportError as e:
    p(f"Skipping issue embedding (missing package: {e})")
    p("Install AI layer deps or run from the AI venv to enable this step.")
except Exception as e:
    p(f"Issue embedding error: {e}")

# ── Done ──────────────────────────────────────────────────────────────────────

print("\n=== Seed complete! ===")
print(f"  Users:    {User.objects.count()}")
print(f"  Projects: {Project.objects.count()}")
print(f"  Sprints:  {Sprint.objects.count()}")
print(f"  Issues:   {Issue.objects.count()}")
print(f"  Wiki:     {WikiPage.objects.count()} pages")
print()
print("  Login credentials (all users): password = Admin@123")
print("  Admin: prashant@brainboard.dev")
