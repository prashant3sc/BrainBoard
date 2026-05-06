# BrainBoard — Backend Documentation

> Django 6 + Django REST Framework REST API serving the BrainBoard frontend and AI service.

---

## Table of Contents

1. [Tech Stack & Project Layout](#1-tech-stack--project-layout)
2. [Environment Variables & Config](#2-environment-variables--config)
3. [Auth & Middleware](#3-auth--middleware)
4. [Database Models & Schema](#4-database-models--schema)
5. [API Endpoints](#5-api-endpoints)
   - [Auth & Users](#51-auth--users)
   - [Projects](#52-projects)
   - [Sprints](#53-sprints)
   - [Issues & Labels](#54-issues--labels)
   - [Comments](#55-comments)
   - [Wiki](#56-wiki)
   - [Search](#57-search)
   - [AI Integration](#58-ai-integration)
6. [Filters & Query Parameters](#6-filters--query-parameters)
7. [Service / Business Logic](#7-service--business-logic)
8. [AI Integration Layer](#8-ai-integration-layer)
9. [Async Tasks (Celery)](#9-async-tasks-celery)
10. [Permissions](#10-permissions)
11. [Serializers](#11-serializers)

---

## 1. Tech Stack & Project Layout

| Package                       | Version | Role                             |
| ----------------------------- | ------- | -------------------------------- |
| Django                        | 6.x     | Web framework, ORM, migrations   |
| djangorestframework           | 3.17.1  | REST API (ViewSets, serializers) |
| djangorestframework-simplejwt | 5.5.1   | JWT authentication               |
| django-filter                 | 25.2    | Query-param filtering            |
| django-cors-headers           | 4.9.0   | CORS for browser clients         |
| psycopg2-binary               | 2.9.11  | PostgreSQL adapter               |
| django-celery-beat            | —       | Periodic async task scheduling   |
| requests                      | 2.33.1  | HTTP client → AI service         |
| python-dotenv                 | 1.2.2   | `.env` loading                   |

```
BE/
├── Dockerfile
├── requirements.txt
├── fix_requirements.py          # Fixes Windows UTF-16 → UTF-8 for Docker
├── manage.py
├── seed_data.py
└── jira_main/
    ├── jira_main/               # Django project config
    │   ├── settings.py
    │   ├── urls.py              # Root router
    │   ├── wsgi.py
    │   └── asgi.py
    ├── users/                   # Auth + user management
    ├── projects/                # Projects, sprints, analytics
    ├── issues/                  # Issues, labels, comments
    ├── wiki/                    # Wiki pages + version history
    ├── search/                  # Full-text + semantic search
    └── ai_integration/          # Proxy to FastAPI AI service + Celery tasks
```

---

## 2. Environment Variables & Config

All values read from `.env` at project root. Django reads them via `os.environ.get()`.

| Variable                | Default                          | Description                                                 |
| ----------------------- | -------------------------------- | ----------------------------------------------------------- |
| `SECRET_KEY`            | _(insecure dev default in code)_ | Django signing key — **must be overridden in production**   |
| `DEBUG`                 | `True`                           | Django debug mode                                           |
| `ALLOWED_HOSTS`         | `localhost,127.0.0.1`            | Comma-separated allowed host headers                        |
| `DB_NAME`               | `jira_main`                      | PostgreSQL database name                                    |
| `DB_USER`               | `postgres`                       | PostgreSQL user                                             |
| `DB_PASSWORD`           | —                                | PostgreSQL password                                         |
| `DB_HOST`               | `localhost`                      | PostgreSQL host (`db` inside Docker)                        |
| `DB_PORT`               | `5432`                           | PostgreSQL port                                             |
| `FRONTEND_URL`          | `http://localhost:5173`          | Used for CORS allow-list                                    |
| `AI_SERVICE_URL`        | `http://localhost:8001`          | Base URL of FastAPI AI service (`http://ai:8001` in Docker) |
| `CELERY_BROKER_URL`     | —                                | Redis URL for Celery task broker                            |
| `CELERY_RESULT_BACKEND` | —                                | Redis URL for Celery result storage                         |

**Key Django settings:**

```python
# JWT token lifetime
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME":  timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
}

# Default authentication
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication"
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend"
    ],
}

# CORS — open in dev
CORS_ALLOW_ALL_ORIGINS = True

# Celery beat schedule
CELERY_BEAT_SCHEDULE = {
    "embed_all_active_sprints": {
        "task": "ai_integration.tasks.embed_all_active_sprints",
        "schedule": crontab(day_of_week=1, hour=9, minute=0),  # Monday 09:00 UTC
    },
    "embed_all_active_project_analytics": {
        "task": "ai_integration.tasks.embed_all_active_project_analytics",
        "schedule": crontab(day_of_week=1, hour=9, minute=0),
    },
}
```

---

## 3. Auth & Middleware

### Middleware stack (order matters)

```
SecurityMiddleware
SessionMiddleware
CommonMiddleware
CsrfViewMiddleware
CorsMiddleware          ← django-cors-headers (must be before CommonMiddleware)
AuthenticationMiddleware
MessageMiddleware
XFrameOptionsMiddleware
```

### JWT Authentication

- Library: `djangorestframework-simplejwt`
- Every protected endpoint requires:
  ```
  Authorization: Bearer <access_token>
  ```
- Login returns both `access` (8 h) and `refresh` (7 days) tokens.
- Refresh via `POST /api/auth/token/refresh/` (simplejwt built-in, also exposed at `/api/v1/auth/refresh`).
- No server-side token revocation — logout is client-side only.
- Custom `User` model uses `email` as `USERNAME_FIELD` (not `username`).

### Permission classes

Four custom permission classes live in `users/permissions.py`:

| Class            | Check                                 | Used by                                                |
| ---------------- | ------------------------------------- | ------------------------------------------------------ |
| `IsOrgAdmin`     | `user.role == "admin"`                | UserCreateView, UserDetailView                         |
| `IsAdminOrPM`    | `user.role in [admin, pm]`            | ProjectCreateView, SprintDetailView, member management |
| `CanCreateIssue` | `user.role in [admin, pm, developer]` | IssueListView, LabelListView                           |
| `CanWriteWiki`   | `user.role in [admin, pm, developer]` | WikiPageListView, WikiPageDetailView (write)           |

Unauthenticated requests receive `401 Unauthorized` on all non-login endpoints.

---

## 4. Database Models & Schema

### ERD (simplified)

```
users_user
  id (UUID PK)
  email (unique)
  role  ──────────────────────────────────────────┐
  avatar_url                                      │
                                                  │ FK owner
projects_project ◄──────────────────────────────┘
  id (UUID PK)
  name
  description
  is_archived
  owner_id → users_user
        │
        │ FK project                 FK project + user
        ├──────────────────► projects_projectmember
        │                      user_id → users_user
        │                      joined_at
        │                      UNIQUE(project, user)
        │
        │ FK project
        ├──────────────────► projects_sprint
        │                      id (UUID PK)
        │                      name, goal
        │                      status: planned|active|completed
        │                      start_date, end_date
        │
        │ FK project
        └──────────────────► issues_issue
                               id (UUID PK)
                               title, description
                               status: todo|in_progress|review|done
                               priority: critical|high|medium|low
                               issue_type: task|subtask|bug
                               story_points (nullable int)
                               due_date (nullable)
                               sprint_id → projects_sprint (nullable)
                               assignee_id → users_user (nullable)
                               reporter_id → users_user
                               parent_id → issues_issue (self, nullable)
                               ORDER BY -created_at
                                    │
                                    │ FK ticket
                                    ├──────────────────► issues_comment
                                    │                      author_id → users_user
                                    │                      body (text)
                                    │                      ORDER BY created_at
                                    │
                                    │ M2M
                                    └──────────────────► issues_label
                                                           name
                                                           color (hex, default #2DD836DA)
                                                           project_id → projects_project
                                                           UNIQUE(name, project)

projects_project
        │ FK project
        └──────────────────► wiki_wikispace
                               id (UUID PK)
                               name, description
                               created_by → users_user
                                    │ FK space (nullable)
                                    └──────► wiki_wikipage
                                               id (UUID PK)
                                               title, content
                                               project_id → projects_project
                                               parent_id → wiki_wikipage (self, nullable)
                                               created_by, updated_by → users_user
                                                    │ FK page
                                                    └──────► wiki_wikipageversion
                                                               version_number (int)
                                                               title, content (snapshot)
                                                               created_by → users_user
                                                               UNIQUE(page, version_number)
                                                               ORDER BY -version_number

wiki_wikipage + issues_issue ──► wiki_ticketpagelink
                                   issue_id (FK)
                                   wiki_page_id (FK)
                                   linked_by → users_user
                                   UNIQUE(issue, wiki_page)
```

### Model field reference

#### `users_user`

| Field        | Type         | Notes                                      |
| ------------ | ------------ | ------------------------------------------ |
| `id`         | UUID         | PK, auto                                   |
| `email`      | EmailField   | unique, used as USERNAME_FIELD             |
| `first_name` | CharField    | inherited                                  |
| `last_name`  | CharField    | inherited                                  |
| `role`       | CharField    | `admin` \| `pm` \| `developer` \| `viewer` |
| `avatar_url` | URLField     | nullable                                   |
| `is_active`  | BooleanField | inherited                                  |

Computed properties:

| Property              | True when                        |
| --------------------- | -------------------------------- |
| `is_org_admin`        | `role == "admin"`                |
| `can_manage_projects` | `role in [admin, pm]`            |
| `can_create_issues`   | `role in [admin, pm, developer]` |
| `can_write_wiki`      | `role in [admin, pm, developer]` |
| `can_plan_sprints`    | `role in [admin, pm]`            |

#### `projects_project`

| Field                       | Type           | Notes         |
| --------------------------- | -------------- | ------------- |
| `id`                        | UUID           | PK            |
| `name`                      | CharField(255) |               |
| `description`               | TextField      |               |
| `owner`                     | FK → User      |               |
| `is_archived`               | BooleanField   | default False |
| `created_at` / `updated_at` | DateTimeField  | auto          |

#### `projects_sprint`

| Field                     | Type          | Notes                                |
| ------------------------- | ------------- | ------------------------------------ |
| `id`                      | UUID          | PK                                   |
| `project`                 | FK → Project  |                                      |
| `name`                    | CharField     |                                      |
| `goal`                    | TextField     |                                      |
| `status`                  | CharField     | `planned` \| `active` \| `completed` |
| `start_date` / `end_date` | DateField     | nullable                             |
| `created_at`              | DateTimeField | auto                                 |

#### `issues_issue`

| Field                       | Type                 | Notes                                         |
| --------------------------- | -------------------- | --------------------------------------------- |
| `id`                        | UUID                 | PK                                            |
| `project`                   | FK → Project         |                                               |
| `sprint`                    | FK → Sprint          | nullable (null = backlog)                     |
| `parent`                    | FK → Issue (self)    | nullable (non-null = subtask)                 |
| `assignee`                  | FK → User            | nullable                                      |
| `reporter`                  | FK → User            | non-null                                      |
| `labels`                    | M2M → Label          |                                               |
| `title`                     | CharField(500)       |                                               |
| `description`               | TextField            |                                               |
| `status`                    | CharField            | `todo` \| `in_progress` \| `review` \| `done` |
| `priority`                  | CharField            | `critical` \| `high` \| `medium` \| `low`     |
| `issue_type`                | CharField            | `task` \| `subtask` \| `bug`                  |
| `story_points`              | PositiveIntegerField | nullable                                      |
| `due_date`                  | DateField            | nullable                                      |
| `created_at` / `updated_at` | DateTimeField        | auto                                          |

#### `issues_label`

| Field     | Type           | Notes                           |
| --------- | -------------- | ------------------------------- |
| `id`      | UUID           | PK                              |
| `name`    | CharField(100) |                                 |
| `color`   | CharField      | hex string, default `#2DD836DA` |
| `project` | FK → Project   |                                 |
|           |                | UNIQUE(name, project)           |

#### `issues_comment`

| Field                       | Type          | Notes                     |
| --------------------------- | ------------- | ------------------------- |
| `id`                        | UUID          | PK                        |
| `ticket`                    | FK → Issue    |                           |
| `author`                    | FK → User     |                           |
| `body`                      | TextField     |                           |
| `created_at` / `updated_at` | DateTimeField | auto, ORDER BY created_at |

#### `wiki_wikispace`

| Field         | Type         | Notes |
| ------------- | ------------ | ----- |
| `id`          | UUID         | PK    |
| `project`     | FK → Project |       |
| `name`        | CharField    |       |
| `description` | TextField    |       |
| `created_by`  | FK → User    |       |

#### `wiki_wikipage`

| Field                       | Type                 | Notes    |
| --------------------------- | -------------------- | -------- |
| `id`                        | UUID                 | PK       |
| `project`                   | FK → Project         |          |
| `space`                     | FK → WikiSpace       | nullable |
| `parent`                    | FK → WikiPage (self) | nullable |
| `title`                     | CharField(500)       |          |
| `content`                   | TextField            |          |
| `created_by` / `updated_by` | FK → User            |          |
| `created_at` / `updated_at` | DateTimeField        | auto     |

#### `wiki_wikipageversion`

| Field               | Type                 | Notes                                                  |
| ------------------- | -------------------- | ------------------------------------------------------ |
| `id`                | UUID                 | PK                                                     |
| `page`              | FK → WikiPage        |                                                        |
| `version_number`    | PositiveIntegerField | auto-incremented on update                             |
| `title` / `content` | fields               | snapshot at save time                                  |
| `created_by`        | FK → User            |                                                        |
| `created_at`        | DateTimeField        | auto                                                   |
|                     |                      | UNIQUE(page, version_number), ORDER BY -version_number |

#### `wiki_ticketpagelink`

| Field        | Type          | Notes                    |
| ------------ | ------------- | ------------------------ |
| `id`         | UUID          | PK                       |
| `issue`      | FK → Issue    |                          |
| `wiki_page`  | FK → WikiPage |                          |
| `linked_by`  | FK → User     |                          |
| `created_at` | DateTimeField | auto                     |
|              |               | UNIQUE(issue, wiki_page) |

---

## 5. API Endpoints

All endpoints are prefixed `/api/v1/` unless noted. All require `Authorization: Bearer <token>` except login/register.

Response shapes use camelCase (serializers apply field renaming). Errors follow DRF standard:

```json
{ "detail": "string" }
// or validation errors:
{ "fieldName": ["error message"] }
```

---

### 5.1 Auth & Users

#### `POST /api/v1/auth/login`

Authenticate with email + password.

**Request body:**

```json
{ "email": "user@example.com", "password": "secret" }
```

**Response `200`:**

```json
{
  "access": "<jwt_access_token>",
  "refresh": "<jwt_refresh_token>",
  "user": {
    "id": "uuid",
    "name": "Alice Smith",
    "email": "user@example.com",
    "role": "developer",
    "avatarUrl": null
  }
}
```

**Errors:** `400` invalid credentials, `403` inactive account.

---

#### `POST /api/v1/auth/refresh`

Exchange a refresh token for a new access token.

**Request body:**

```json
{ "refresh": "<jwt_refresh_token>" }
```

**Response `200`:**

```json
{ "access": "<new_jwt_access_token>" }
```

---

#### `POST /api/v1/auth/logout`

Client-side only — no server-side token invalidation. Returns `200` unconditionally.

---

#### `GET /api/v1/auth/me`

Returns the authenticated user's profile.

**Response `200`:**

```json
{
  "id": "uuid",
  "name": "Alice Smith",
  "email": "user@example.com",
  "role": "pm",
  "avatarUrl": "https://..."
}
```

#### `PATCH /api/v1/auth/me`

Update own profile or change password.

**Request body (any subset):**

```json
{
  "firstName": "Alice",
  "lastName": "Smith",
  "avatarUrl": "https://...",
  "currentPassword": "old",
  "newPassword": "new_min8chars"
}
```

---

#### `GET /api/v1/users/`

List all users. Requires `IsOrgAdmin`.

**Query params:** `role`, `email`, `search` (name or email icontains).

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "name": "...",
    "email": "...",
    "role": "...",
    "avatarUrl": null
  }
]
```

---

#### `POST /api/v1/users/create`

Create a new user. Requires `IsOrgAdmin`.

**Request body:**

```json
{
  "email": "new@example.com",
  "password": "min8chars",
  "firstName": "Bob",
  "lastName": "Jones",
  "role": "developer"
}
```

**Response `201`:** User object (same shape as GET).

---

#### `GET /api/v1/users/{id}/`

Retrieve a user by ID. Requires `IsOrgAdmin`.

#### `PATCH /api/v1/users/{id}/`

Update user role. Requires `IsOrgAdmin`. Cannot target own account.

**Request body:**

```json
{ "role": "pm" }
```

#### `DELETE /api/v1/users/{id}/`

Delete a user. Requires `IsOrgAdmin`. Cannot delete own account.

---

### 5.2 Projects

#### `GET /api/v1/projects/`

List projects visible to the authenticated user.

- Admin: all projects.
- PM/Developer/Viewer: projects they own or are a member of.

**Query params:** `search` (name or description), `is_archived` (`true`/`false`).

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "name": "Project Alpha",
    "description": "...",
    "ownerId": "uuid",
    "memberIds": ["uuid", "uuid"],
    "isArchived": false,
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

---

#### `POST /api/v1/projects/create`

Create a project. Requires `IsAdminOrPM`.

**Request body:**

```json
{ "name": "Project Alpha", "description": "...", "ownerId": "uuid" }
```

`ownerId` defaults to the requesting user if omitted.

**Side effect:** auto-creates 4 default labels — `Frontend`, `Backend`, `Data Science`, `QA Testing`.

**Response `201`:** Project object.

---

#### `GET /api/v1/projects/{id}/`

Retrieve project detail.

#### `PATCH /api/v1/projects/{id}/`

Update a project. PM can only update projects they own; Admin can update any.

**Request body (any subset):**

```json
{ "name": "...", "description": "...", "isArchived": true }
```

#### `DELETE /api/v1/projects/{id}/`

Delete a project. Admin only.

---

#### `GET /api/v1/projects/{id}/members/`

List project members.

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "user": {
      "id": "uuid",
      "name": "...",
      "email": "...",
      "role": "developer",
      "avatarUrl": null
    },
    "joinedAt": "2025-01-01T00:00:00Z"
  }
]
```

#### `POST /api/v1/projects/{id}/members/add`

Add a user to the project. Requires `IsAdminOrPM`.

**Request body:**

```json
{ "userId": "uuid" }
```

**Response `201`:** ProjectMember object.

#### `DELETE /api/v1/projects/{id}/members/{user_id}/`

Remove a member. Requires `IsAdminOrPM`.

---

#### `GET /api/v1/projects/{id}/analytics/velocity`

Sprint velocity analytics for the project.

**Response `200`:**

```json
[
  {
    "sprintName": "Sprint 1",
    "committed": 20,
    "completed": 15,
    "completionRate": 0.75
  }
]
```

#### `GET /api/v1/projects/{id}/analytics/workload`

Per-member workload breakdown.

**Response `200`:**

```json
[
  {
    "userId": "uuid",
    "name": "Alice",
    "openByStatus": { "todo": 3, "in_progress": 2, "review": 1 },
    "totalStoryPoints": 13,
    "priorityCounts": { "critical": 1, "high": 2, "medium": 3, "low": 0 }
  }
]
```

---

### 5.3 Sprints

#### `GET /api/v1/projects/{id}/sprints/`

List sprints for a project.

**Query params:** `status` (`planned` \| `active` \| `completed`).

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "name": "Sprint 1",
    "goal": "...",
    "status": "active",
    "startDate": "2025-01-01",
    "endDate": "2025-01-14",
    "project": "uuid",
    "createdAt": "2025-01-01T00:00:00Z"
  }
]
```

#### `POST /api/v1/projects/{id}/sprints/`

Create a sprint. Requires `can_plan_sprints` (admin or PM).

**Request body:**

```json
{
  "name": "Sprint 2",
  "goal": "Finish auth",
  "startDate": "2025-01-15",
  "endDate": "2025-01-28"
}
```

**Response `201`:** Sprint object with `status: "planned"`.

---

#### `GET /api/v1/projects/{id}/active-sprint/`

Returns the single active sprint with its issues. Supports optional multi-assignee filter.

**Query params:** `assignee_ids` (comma-separated UUIDs).

**Response `200`:**

```json
{
  "sprint": { "id": "uuid", "name": "Sprint 1", "status": "active", ... },
  "issues": [{ ...issue object... }]
}
```

---

#### `PATCH /api/v1/sprints/{id}/`

Transition sprint status. Requires `IsAdminOrPM`.

**Request body:**

```json
{ "status": "active" }
```

Valid transitions: `planned → active`, `active → completed`.

On `active → completed`: unfinished tickets (not `done`) are moved to backlog (`sprint = null`) automatically.

---

### 5.4 Issues & Labels

#### `GET /api/v1/projects/{id}/issues/`

List issues for a project. Supports rich filtering (see [§6](#6-filters--query-parameters)).

**Annotations added to each result:**

- `subtaskCount` — total child issues
- `doneSubtaskCount` — child issues with `status=done`
- `progress` — `doneSubtaskCount / subtaskCount` (0–1, null if no subtasks)

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "title": "Fix login bug",
    "description": "...",
    "status": "todo",
    "priority": "high",
    "issueType": "bug",
    "storyPoints": 3,
    "dueDate": "2025-02-01",
    "projectId": "uuid",
    "sprintId": "uuid",
    "assigneeId": "uuid",
    "reporterId": "uuid",
    "parentId": null,
    "labels": [{ "id": "uuid", "name": "Backend", "color": "#2DD836DA" }],
    "subtaskCount": 2,
    "doneSubtaskCount": 1,
    "progress": 0.5,
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

#### `POST /api/v1/issues/` (no project prefix)

Create an issue. Requires `can_create_issues`.

**Request body:**

```json
{
  "projectId": "uuid",
  "title": "Fix login bug",
  "description": "...",
  "status": "todo",
  "priority": "high",
  "issueType": "bug",
  "storyPoints": 3,
  "dueDate": "2025-02-01",
  "sprintId": "uuid",
  "assigneeId": "uuid",
  "parentId": "uuid",
  "labelIds": ["uuid"]
}
```

`parentId` is required when `issueType == "subtask"`.
`projectId` is always required.

**Response `201`:** Full issue object.

**Side effect:** `post_save` signal fires → Celery task `embed_ticket` queues async ChromaDB upsert.

---

#### `GET /api/v1/issues/{id}/`

Retrieve issue detail including comments and linked wiki pages.

#### `PATCH /api/v1/issues/{id}/`

Update issue fields. All fields optional (partial update). Requires role ≥ developer.

**Request body (any subset):**

```json
{
  "title": "...",
  "status": "in_progress",
  "assigneeId": "uuid",
  "sprintId": null,
  "labelIds": ["uuid"]
}
```

`labelIds` replaces the entire label set. Pass `null` to `assigneeId` / `sprintId` / `parentId` to clear.

**Side effect:** `post_save` signal → `embed_ticket` Celery task.

#### `DELETE /api/v1/issues/{id}/`

Delete issue. Requires `can_manage_projects` (admin or PM).

---

#### `GET /api/v1/projects/{id}/labels/`

List labels for a project.

**Response `200`:**

```json
[{ "id": "uuid", "name": "Backend", "color": "#2DD836DA", "project": "uuid" }]
```

#### `POST /api/v1/projects/{id}/labels/`

Create a label. Requires `can_create_issues`.

**Request body:**

```json
{ "name": "QA", "color": "#FF0000" }
```

#### `DELETE /api/v1/projects/{id}/labels/{label_id}/`

Delete a label. Requires `can_manage_projects`.

---

### 5.5 Comments

#### `GET /api/v1/issues/{id}/comments/` _(via IssueDetailView)_

Comments are returned inline in the issue detail response, ordered by `created_at` ascending.

#### `POST /api/v1/issues/{id}/comments/`

Add a comment. Any authenticated user.

**Request body:**

```json
{ "body": "Looks good to me." }
```

**Response `201`:**

```json
{
  "id": "uuid",
  "author": { "id": "uuid", "name": "Alice", "role": "developer" },
  "body": "Looks good to me.",
  "createdAt": "...",
  "updatedAt": "..."
}
```

**Side effect:** `post_save` signal on Comment → `embed_ticket` Celery task re-embeds parent issue (with comment text appended).

---

### 5.6 Wiki

#### `GET /api/v1/projects/{id}/wiki/`

List wiki pages for a project.

**Query params:** `space_id`, `parent_id`, `root_only=true` (pages with no parent), `search` (title or content).

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "title": "Getting Started",
    "content": "...",
    "parentId": null,
    "projectId": "uuid",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

---

#### `POST /api/v1/wiki/`

Create a wiki page. Requires `can_write_wiki`.

**Request body:**

```json
{
  "projectId": "uuid",
  "title": "API Design",
  "content": "## Overview\n...",
  "spaceId": "uuid",
  "parentId": "uuid"
}
```

`spaceId` and `parentId` are optional.

**Side effect:** auto-creates `WikiPageVersion` with `version_number=1`. `post_save` signal → `embed_wiki_page` Celery task.

**Response `201`:** WikiPage object.

---

#### `GET /api/v1/wiki/{id}/`

Retrieve a wiki page.

#### `PATCH /api/v1/wiki/{id}/`

Update a wiki page. Requires `can_write_wiki`.

**Request body (any subset):**

```json
{ "title": "Updated Title", "content": "New content...", "parentId": "uuid" }
```

**Side effect:** auto-increments `version_number` and saves a new `WikiPageVersion` snapshot. `post_save` signal → `embed_wiki_page`.

#### `DELETE /api/v1/wiki/{id}/`

Delete a wiki page. Requires `can_manage_projects`.

---

#### `GET /api/v1/wiki/{id}/history/`

List all versions of a wiki page, newest first.

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "versionNumber": 3,
    "title": "...",
    "content": "...",
    "createdBy": { "id": "uuid", "name": "Alice" },
    "createdAt": "..."
  }
]
```

---

#### `GET /api/v1/wiki/{id}/link-ticket/`

List all issues linked to this wiki page.

**Response `200`:** Array of `{ issue: { id, title, issueType }, wikiPage, createdAt }`.

#### `POST /api/v1/wiki/{id}/link-ticket/`

Link an issue to a wiki page.

**Request body:**

```json
{ "issueId": "uuid" }
```

#### `DELETE /api/v1/wiki/{id}/link-ticket/`

Remove a link between an issue and this wiki page.

**Request body:**

```json
{ "issueId": "uuid" }
```

---

### 5.7 Search

#### `POST /api/v1/search/`

Full-text keyword search across issues and wiki pages (case-insensitive `icontains`).

**Request body:**

```json
{ "query": "login bug", "projectId": "uuid" }
```

`projectId` is optional — omit to search globally.

**Response `200`:**

```json
{
  "issues": [
    {
      "id": "uuid",
      "title": "Fix login bug",
      "excerpt": "...matched text snippet...",
      "projectId": "uuid"
    }
  ],
  "wikiPages": [
    {
      "id": "uuid",
      "title": "Auth Design",
      "excerpt": "...matched text snippet...",
      "projectId": "uuid"
    }
  ]
}
```

Returns up to 20 results per type.

---

#### `POST /api/v1/search/semantic/`

Semantic (vector similarity) search powered by ChromaDB. Proxies to AI service, then enriches results with `projectId` from the PostgreSQL DB.

**Request body:**

```json
{ "query": "authentication flow", "k": 10 }
```

**Response `200`:**

```json
[
  {
    "id": "uuid",
    "type": "ticket",
    "title": "Implement OAuth",
    "excerpt": "...",
    "projectId": "uuid"
  }
]
```

---

### 5.8 AI Integration

All `/api/v1/ai/` endpoints proxy requests to the FastAPI AI service after injecting project context and enforcing Django auth.

---

#### `GET /api/v1/ai/health/`

Forward health check to AI service.

**Response `200`:**

```json
{ "status": "healthy", "service": "JiraGenie AI" }
```

---

#### `POST /api/v1/ai/sync/`

Trigger a full Postgres → ChromaDB re-sync.

**Request body (optional):**

```json
{ "projectId": "uuid" }
```

Omit `projectId` to sync all data. Fetches issues, wiki pages, users, projects, and sprints from PostgreSQL, formats them as documents, and POSTs to `/api/v1/team/full-sync` on the AI service.

**Response `200`:**

```json
{ "status": "ok", "synced": 142 }
```

---

#### `GET /api/v1/ai/sync/status/`

Compare PostgreSQL row counts vs ChromaDB document counts side-by-side.

**Response `200`:**

```json
{
  "postgres": { "issues": 80, "wikiPages": 12, "users": 8 },
  "chromadb": { "issues": 80, "wikiPages": 11, "users": 8 }
}
```

---

#### `POST /api/v1/ai/analyze-issue/{issue_id}/`

Estimate story points and recommend team members for an existing issue.

Fetches the issue from PostgreSQL, sends it to the AI service, then maps the recommended assignee names back to project member UUIDs.

**Response `200`:**

```json
{
  "storyPoints": 5,
  "justification": "Medium-complexity backend task with DB migration.",
  "requiredRoles": ["backend", "qa"],
  "capacityAnalysis": "Team has capacity in the current sprint.",
  "recommendedTeam": {
    "backend": { "id": "uuid", "name": "Alice" },
    "qa": { "id": "uuid", "name": "Bob" }
  }
}
```

---

#### `POST /api/v1/ai/analyze-draft/`

Same as above but for an unsaved issue (no DB lookup needed).

**Request body:**

```json
{
  "title": "Add OAuth login",
  "description": "Support Google + GitHub OAuth flows.",
  "labels": ["Backend", "Frontend"]
}
```

**Response `200`:** Same shape as `analyze-issue`.

---

#### `POST /api/v1/ai/chat/`

Read-only RAG chatbot — answers questions about the workspace.

**Request body:**

```json
{
  "message": "What issues are blocking the sprint?",
  "projectName": "Project Alpha"
}
```

**Response `200`:**

```json
{
  "answer": "There are 2 critical issues assigned to Alice...",
  "sources": [{ "type": "ticket", "id": "uuid", "title": "Auth timeout bug" }]
}
```

---

#### `GET /api/v1/projects/{id}/ai-pulse/`

Sprint pulse — real stats from PostgreSQL plus an AI-generated summary for the active sprint.

**Response `200`:**

```json
{
  "sprint": {
    "id": "uuid",
    "name": "Sprint 3",
    "startDate": "...",
    "endDate": "..."
  },
  "stats": {
    "total": 20,
    "done": 12,
    "inProgress": 5,
    "todo": 3,
    "storyPointsDone": 34,
    "storyPointsTotal": 60
  },
  "teamWorkload": [{ "name": "Alice", "open": 3, "highPriority": 1 }],
  "aiSummary": "The team is tracking well with 60% completion...",
  "highlights": [
    { "text": "3 critical issues still open", "tag": "risk" },
    { "text": "Alice leads velocity this sprint", "tag": "info" }
  ]
}
```

---

#### `POST /api/v1/ai/chatbot/query/`

Project-scoped multi-turn AI assistant. The main chatbot used by the FE `ChatPanel`.

**Request body:**

```json
{
  "query": "Who is working on authentication?",
  "projectId": "uuid",
  "sprintId": "uuid",
  "page": "kanban",
  "history": [
    { "role": "user", "content": "What sprints do we have?" },
    {
      "role": "assistant",
      "content": "You have Sprint 1 (active) and Sprint 2 (planned)."
    }
  ]
}
```

| Field       | Type   | Required | Notes                                                         |
| ----------- | ------ | -------- | ------------------------------------------------------------- |
| `query`     | string | yes      | User's question                                               |
| `projectId` | UUID   | no       | Scopes ChromaDB search to project                             |
| `sprintId`  | UUID   | no       | Further scopes to sprint                                      |
| `page`      | string | no       | `kanban` \| `backlog` \| `wiki` \| `analytics` \| `dashboard` |
| `history`   | array  | no       | Prior turns, capped at last 4                                 |

**Server-side pipeline:**

1. Validate input via `ChatbotQuerySerializer`.
2. `classifier.classify_query()` — rule-based keyword matching decides `needs_chromadb`, `doc_types` to retrieve, and whether to fetch `team_bandwidth`.
3. Parallel (ThreadPoolExecutor):
   - ChromaDB vector search (filtered by project/sprint/doc_types).
   - `get_team_bandwidth()` SQL query (if bandwidth keywords detected).
4. `page_context.get_page_context()` — live DB data for current UI page.
5. Build LLM messages from `CHATBOT_SYSTEM_PROMPT` template + context.
6. Call AI service `/api/v1/llm/generate`.
7. Assemble source citations from ChromaDB metadata.

**Response `200`:**

```json
{
  "answer": "Alice and Bob are working on the auth issues...",
  "sources": [
    { "type": "ticket", "id": "uuid", "title": "Implement OAuth" },
    { "type": "wiki", "id": "uuid", "title": "Auth Design Doc" }
  ]
}
```

---

## 6. Filters & Query Parameters

### Issues (`IssueFilter`)

| Param             | Lookup                         | Example                       |
| ----------------- | ------------------------------ | ----------------------------- |
| `status`          | exact                          | `?status=in_progress`         |
| `priority`        | exact                          | `?priority=high`              |
| `issue_type`      | exact                          | `?issue_type=bug`             |
| `assignee_id`     | exact                          | `?assignee_id=<uuid>`         |
| `sprint_id`       | exact                          | `?sprint_id=<uuid>`           |
| `backlog`         | isnull on sprint               | `?backlog=true`               |
| `label_id`        | exact                          | `?label_id=<uuid>`            |
| `due_date_before` | lte                            | `?due_date_before=2025-02-01` |
| `due_date_after`  | gte                            | `?due_date_after=2025-01-01`  |
| `search`          | icontains title \| description | `?search=login`               |

### Projects (`ProjectFilter`)

| Param         | Lookup                        | Example              |
| ------------- | ----------------------------- | -------------------- |
| `search`      | icontains name \| description | `?search=alpha`      |
| `is_archived` | exact                         | `?is_archived=false` |

### Sprints (`SprintFilter`)

| Param    | Lookup | Example          |
| -------- | ------ | ---------------- |
| `status` | exact  | `?status=active` |

### Users (`UserFilter`)

| Param    | Lookup                                     | Example           |
| -------- | ------------------------------------------ | ----------------- |
| `role`   | exact                                      | `?role=developer` |
| `email`  | icontains                                  | `?email=alice`    |
| `search` | icontains first_name \| last_name \| email | `?search=alice`   |

### Wiki (`WikiPageFilter`)

| Param       | Lookup                     | Example             |
| ----------- | -------------------------- | ------------------- |
| `space_id`  | exact                      | `?space_id=<uuid>`  |
| `parent_id` | exact                      | `?parent_id=<uuid>` |
| `root_only` | isnull on parent           | `?root_only=true`   |
| `search`    | icontains title \| content | `?search=auth`      |

---

## 7. Service / Business Logic

### `projects/views.py` — key business rules

**ProjectCreateView**

- Caller becomes project owner if `ownerId` is not supplied.
- Always seeds 4 default labels: `Frontend`, `Backend`, `Data Science`, `QA Testing`.

**ActiveSprintView**

- Returns exactly one `ACTIVE` sprint per project (there should only ever be one).
- Supports `?assignee_ids=uuid,uuid` to filter the issue list to specific team members without changing sprint metadata.

**SprintDetailView** (status transitions)

- `planned → active`: sets `start_date = today` if not already set.
- `active → completed`: bulk-updates all non-`done` issues in the sprint to `sprint = null` (moves them to backlog). Completed issues stay attached for history.

**VelocityView**

- Queries all `COMPLETED` sprints, counts committed story points (all issues in sprint at close) vs completed (status `done`).
- Returns `completionRate = completed / committed` per sprint.

**WorkloadView**

- Groups open issues by `assignee` across the project (not scoped to a sprint).
- Returns per-member: status breakdown, total story points, priority distribution.

---

### `issues/views.py`

**annotate_issues() helper**
Every issue list query is annotated with:

```python
.annotate(
    subtask_count=Count("issue", filter=Q(issue__isnull=False)),
    done_subtask_count=Count("issue", filter=Q(issue__status="done")),
)
```

These become `subtaskCount` and `doneSubtaskCount` in the response, with `progress` computed in the serializer.

**IssueDetailView (PATCH)**

- `labelIds` in the request body triggers a full `.set()` on the M2M — not an append. Send all desired label IDs each time.
- Passing `null` for `assigneeId`, `sprintId`, or `parentId` explicitly clears that FK.

---

### `wiki/views.py`

**WikiPageListView (POST) / WikiPageDetailView (PATCH)**

- On create: saves page then creates `WikiPageVersion(version_number=1, ...)`.
- On update: fetches `max(version_number)` for the page, saves a new version at `max + 1`.
- Version history is immutable — old versions are never deleted.

---

### `users/views.py`

**UserCreateView**

- Password minimum length: 8 characters (validated in `UserCreateSerializer`).
- `username` field is auto-set to `email` (because `USERNAME_FIELD = "email"`).

**UserProfileView (PATCH)**

- Password change requires `currentPassword` to be correct before `newPassword` is accepted.

---

## 8. AI Integration Layer

Located in `ai_integration/`. Acts as a proxy + context enrichment layer between Django and the FastAPI AI service.

### `ai_client.py`

Thin HTTP wrapper around the AI service using the `requests` library. All functions raise on non-2xx responses.

| Function                                                         | AI Endpoint             | Timeout |
| ---------------------------------------------------------------- | ----------------------- | ------- |
| `full_sync(payload)`                                             | `POST /sync`            | 180 s   |
| `sync_status()`                                                  | `GET /sync/status`      | 10 s    |
| `analyze_task(heading, desc, labels)`                            | `POST /analyze-task`    | 180 s   |
| `chat(message, project_name)`                                    | `POST /chat`            | 180 s   |
| `sprint_pulse(sprint, issues)`                                   | `POST /sprint-pulse`    | 180 s   |
| `semantic_search(query, k)`                                      | `POST /search/semantic` | 30 s    |
| `embed_upsert(doc_id, text, metadata)`                           | `POST /embed/upsert`    | 30 s    |
| `chromadb_query(query, project_id, doc_types, sprint_id, top_k)` | `POST /chromadb/query`  | 30 s    |
| `llm_generate(messages, model_key, json_mode)`                   | `POST /llm/generate`    | 180 s   |
| `health_check()`                                                 | `GET /health`           | 10 s    |

---

### `classifier.py`

Rule-based keyword classifier. Called before every `ChatbotQueryView` to decide what data to retrieve.

**Input:** `query` string + `page` string.

**Output:**

```python
{
  "needs_chromadb": bool,
  "doc_types": ["ticket", "wiki", "sprint", "analytics", "user", "project"],
  "sql_queries": ["bandwidth"]   # list of extra SQL lookups to run
}
```

**Keyword sets:**

- `_BANDWIDTH_KEYWORDS` — "who is working", "workload", "capacity", "assigned to", etc.
- `_WIKI_KEYWORDS` — "document", "wiki", "guide", "design doc", etc.
- `_SPRINT_KEYWORDS` — "sprint", "velocity", "burndown", "backlog", etc.
- `_ANALYTICS_KEYWORDS` — "metrics", "trend", "completed last week", etc.
- `_TICKET_KEYWORDS` — "issue", "bug", "task", "ticket", "story", etc.
- `_PROJECT_KEYWORDS` — "project", "overview", "members", etc.

**Page-based defaults** (applied when no keywords match):
| Page | Default doc_types |
|---|---|
| `kanban` | `[ticket, sprint]` |
| `backlog` | `[ticket]` |
| `wiki` | `[wiki]` |
| `analytics` | `[analytics]` |
| `dashboard` | `[project, ticket]` |
| _(fallback)_ | `[ticket, wiki, sprint, project]` |

---

### `page_context.py`

Generates a structured data dict from live PostgreSQL queries for the current UI page. Passed to the LLM as grounding context.

| Page        | Data returned                                                                                |
| ----------- | -------------------------------------------------------------------------------------------- |
| `kanban`    | active sprint name, in-progress count, blocked tickets (CRITICAL + not DONE), team bandwidth |
| `backlog`   | unassigned issue count, next planned sprint name                                             |
| `wiki`      | _(empty — wiki content already in ChromaDB)_                                                 |
| `analytics` | last 4 weekly snapshots (created, closed, avg cycle days, velocity)                          |
| `dashboard` | active projects with ticket counts, in-progress count, blocked count                         |

`to_prompt_text(context_dict)` converts the dict to a plain-text block injected into the LLM system prompt.

`get_team_bandwidth(project_id)` runs a single raw SQL join across `projects_projectmember → auth_user → issues_issue` and returns strings like `"Alice — 3 open, 1 high priority"`.

---

### `prompts.py`

Defines `CHATBOT_SYSTEM_PROMPT` — a string template with these placeholders:

| Placeholder           | Content                                    |
| --------------------- | ------------------------------------------ |
| `{page}`              | Current UI page name                       |
| `{page_context}`      | Output of `to_prompt_text()`               |
| `{chromadb_context}`  | Full text of retrieved ChromaDB docs       |
| `{bandwidth_section}` | Team bandwidth paragraph (or empty string) |

Prompt instructs the LLM to:

- Prefer live page data for counts and current state.
- Prefer workspace knowledge (ChromaDB) for descriptions and history.
- Keep responses under 150 words.
- Never invent facts not present in the context.

---

## 9. Async Tasks (Celery)

Broker and result backend: **Redis** (configured via env vars).

Beat schedule: **every Monday 09:00 UTC**.

### Task reference

| Task                                 | Trigger                         | What it does                                                                                                                   |
| ------------------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `embed_ticket`                       | `post_save` on Issue or Comment | Fetches issue + labels + assignee + comments → formats as text doc → `embed_upsert` to ChromaDB as `ticket_{issue_id}`         |
| `embed_wiki_page`                    | `post_save` on WikiPage         | Fetches page → `embed_upsert` as `wiki_{page_id}`                                                                              |
| `embed_sprint_summary`               | Beat (fan-out) or manual        | Computes sprint stats (done/in*progress/blocked counts, story points) → upsert as `sprint*{sprint_id}`                         |
| `embed_analytics_snapshot`           | Beat (fan-out) or manual        | Computes weekly analytics for a project (created/closed/cycle*time/velocity) → upsert as `analytics*{project*id}*{week_start}` |
| `embed_all_active_sprints`           | Beat entry point                | Fans out `embed_sprint_summary` for every ACTIVE sprint                                                                        |
| `embed_all_active_project_analytics` | Beat entry point                | Fans out `embed_analytics_snapshot` for all non-archived projects                                                              |

All tasks use `max_retries=3` with a 30–60 s retry delay.

### Signals (`signals.py`)

Registered in `issues/apps.py` and `wiki/apps.py` via `AppConfig.ready()`.

```
Issue.post_save  ──► embed_ticket.delay(issue_id)
Comment.post_save ──► embed_ticket.delay(parent_issue_id)
WikiPage.post_save ──► embed_wiki_page.delay(page_id)
```

`dispatch_uid` prevents double-registration when `DEBUG=True` causes app registry reload.

---

## 10. Permissions

### Role hierarchy

```
admin  ──► full access (create users, delete anything, manage all projects)
  pm   ──► manage own projects, plan sprints, create/delete issues
developer ──► create/edit issues, write wiki
  viewer ──► read-only (GET endpoints only)
```

### Permission class → endpoint mapping

| Permission Class                     | Endpoints                                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| `IsAuthenticated` (default)          | All endpoints not listed below                                                                     |
| `IsOrgAdmin`                         | `POST /users/create`, `GET/PATCH/DELETE /users/{id}/`                                              |
| `IsAdminOrPM`                        | `POST /projects/create`, `PATCH/DELETE /projects/{id}/`, member management, `PATCH /sprints/{id}/` |
| `CanCreateIssue`                     | `POST /issues/`, `POST/GET /labels/`                                                               |
| `CanWriteWiki`                       | `POST /wiki/`, `PATCH /wiki/{id}/`                                                                 |
| `can_manage_projects` check (inline) | `DELETE /issues/{id}/`, `DELETE /wiki/{id}/`, `DELETE /labels/{id}/`                               |

---

## 11. Serializers

### Naming convention

All serializers output **camelCase** JSON (field renaming applied in serializer `source` arguments or via custom `to_representation`). Input accepts the same camelCase field names.

### Key serializers

#### `IssueSerializer` (read)

Returns all issue fields plus computed `subtaskCount`, `doneSubtaskCount`, `progress`. Nested `labels` array (full label objects). Nested `assignee` and `reporter` as minimal user objects.

#### `IssueCreateSerializer` (write)

- `projectId` required.
- `parentId` required when `issueType == "subtask"` (validated in `validate()`).
- `labelIds` resolves UUIDs to Label instances via `PrimaryKeyRelatedField`.

#### `IssueUpdateSerializer` (write)

- All fields optional.
- `labelIds` triggers full `.set()` replace on M2M — not append.
- Nullable FK fields (`assigneeId`, `sprintId`, `parentId`) accept `null` to clear.

#### `WikiPageUpdateSerializer` (write)

- Calls `WikiPageVersion.objects.create(...)` in `update()` with auto-incremented `version_number`.

#### `ChatbotQuerySerializer` (write)

- `history` list capped at last 4 turns (sliced in `validate()`).
- `page` choices: `kanban`, `backlog`, `wiki`, `analytics`, `dashboard`.
- `projectId` and `sprintId` are optional UUIDs.

#### `LoginSerializer` (write)

- Calls `django.contrib.auth.authenticate(email=..., password=...)`.
- Returns `401` if credentials invalid, `403` if `user.is_active == False`.
