# BrainBoard — Backend

A REST API backend for BrainBoard, an AI-powered Knowledge Management System (KMS) built with Django and Django REST Framework. It handles user authentication, project/sprint management, issue tracking, wiki pages with version history, and global search.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Django Apps](#django-apps)
- [Data Models](#data-models)
- [API Endpoints](#api-endpoints)
- [Authentication & Authorization](#authentication--authorization)
- [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
- [Key Business Logic](#key-business-logic)
- [Search](#search)
- [Admin Interface](#admin-interface)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Django 6.0.4 |
| REST API | Django REST Framework 3.17.1 |
| Authentication | JWT via `djangorestframework-simplejwt` |
| Database | PostgreSQL (psycopg2-binary) |
| CORS | `django-cors-headers` |
| Server | WSGI (Gunicorn-compatible) / ASGI |

---

## Architecture Overview

```
BE/
├── jira_main/              # Django project root
│   ├── jira_main/          # Project config (settings, root URLs, WSGI/ASGI)
│   ├── users/              # Auth, custom User model, RBAC permissions
│   ├── projects/           # Projects, project members, sprints
│   ├── issues/             # Issues (tickets), labels
│   ├── wiki/               # Wiki spaces, pages, version history, ticket-page links
│   └── search/             # Global search across issues and wiki pages
└── requirements.txt
```

All apps are registered Django apps. No ViewSets are used — every endpoint is a class-based `APIView` for explicit, readable routing.

The **search** app is a thin placeholder that uses PostgreSQL `icontains` lookups today. The interface is defined so the DS team can swap the internal implementation to a FastAPI semantic search endpoint without any frontend changes.

---

## Django Apps

### `users`
Handles custom user model, JWT login/logout, profile management, and admin user operations.

### `projects`
Manages projects, project membership, and sprints. Enforces one active sprint per project.

### `issues`
Manages issues (tickets) and labels. Issues are project-scoped and always belong to a sprint or the backlog (sprint = null).

### `wiki`
Manages wiki spaces, hierarchical pages, immutable version snapshots, and issue-to-page cross-links.

### `search`
Provides a single `POST /search` endpoint that queries issues and wiki pages by keyword.

---

## Data Models

### User

Extends Django's `AbstractUser`. Email is the login identifier (`USERNAME_FIELD = "email"`).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | string | Unique, used for login |
| `first_name` | string | |
| `last_name` | string | |
| `role` | enum | `admin` \| `pm` \| `developer` \| `viewer` |
| `avatar_url` | URL | Optional |

**Computed properties on the model:**

| Property | Roles |
|---|---|
| `is_org_admin` | admin |
| `can_manage_projects` | admin, pm |
| `can_create_issues` | admin, pm, developer |
| `can_write_wiki` | admin, pm, developer |
| `can_plan_sprints` | admin, pm |

---

### Project

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | |
| `description` | text | |
| `owner` | FK → User | SET_NULL on delete |
| `is_archived` | bool | Default false; excluded from list views by default |
| `created_at` | datetime | Auto |
| `updated_at` | datetime | Auto |

---

### ProjectMember

Join table between Project and User.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `project` | FK → Project | CASCADE |
| `user` | FK → User | CASCADE |
| `joined_at` | datetime | Auto |

**Unique constraint**: `(project, user)`

---

### Sprint

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `project` | FK → Project | CASCADE |
| `name` | string | |
| `goal` | text | |
| `status` | enum | `planned` \| `active` \| `completed` |
| `start_date` | date | Optional |
| `end_date` | date | Optional |
| `created_at` | datetime | Auto |

**Business rule:** Only one sprint per project can be in `active` status at a time.

---

### Label

Project-scoped issue labels.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | |
| `color` | string | Hex color, default `#2DD836DA` |
| `project` | FK → Project | CASCADE |

**Unique constraint**: `(name, project)`

---

### Issue

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | string | |
| `description` | text | |
| `status` | enum | `todo` \| `in_progress` \| `review` \| `done` |
| `priority` | enum | `critical` \| `high` \| `medium` \| `low` |
| `story_points` | int | Optional |
| `project` | FK → Project | CASCADE |
| `sprint` | FK → Sprint | SET_NULL (null = backlog) |
| `assignee` | FK → User | SET_NULL, optional |
| `reporter` | FK → User | SET_NULL, auto-set to request.user on create |
| `labels` | M2M → Label | Optional |
| `created_at` | datetime | Auto |
| `updated_at` | datetime | Auto |

---

### WikiSpace

Top-level namespace for a group of wiki pages within a project.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | |
| `description` | text | |
| `project` | FK → Project | CASCADE |
| `created_by` | FK → User | SET_NULL |
| `created_at` | datetime | Auto |

---

### WikiPage

Supports hierarchical pages (parent → children) within a WikiSpace.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | string | |
| `content` | text | Markdown |
| `project` | FK → Project | CASCADE |
| `space` | FK → WikiSpace | SET_NULL, optional |
| `parent` | self-FK → WikiPage | CASCADE; deleting a page cascades to all children |
| `created_by` | FK → User | SET_NULL |
| `updated_by` | FK → User | SET_NULL |
| `created_at` | datetime | Auto |
| `updated_at` | datetime | Auto |

---

### WikiPageVersion

Immutable snapshot of a page at a point in time.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `page` | FK → WikiPage | CASCADE |
| `title` | string | Snapshot |
| `content` | text | Snapshot |
| `version_number` | int | Increments on each update |
| `created_by` | FK → User | SET_NULL |
| `created_at` | datetime | Auto |

**Unique constraint**: `(page, version_number)`

Version 1 is created automatically when a page is created. Every PATCH creates the next version.

---

### TicketPageLink

Cross-link between an Issue and a WikiPage.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `issue` | FK → Issue | CASCADE |
| `wiki_page` | FK → WikiPage | CASCADE |
| `linked_by` | FK → User | SET_NULL |
| `created_at` | datetime | Auto |

**Unique constraint**: `(issue, wiki_page)`

---

## API Endpoints

All endpoints return JSON. The API uses **camelCase** field names in responses.

### Auth

| Method | URL | Description | Auth |
|---|---|---|---|
| POST | `/auth/login` | Login with email + password, returns JWT | Public |
| POST | `/auth/logout` | Client-side token invalidation | Required |
| GET | `/auth/me` | Own user profile | Required |
| PATCH | `/auth/me` | Change own password | Required |

### Users

| Method | URL | Description | Auth |
|---|---|---|---|
| GET | `/users` | List all users (filter: role, email, search) | Required |
| POST | `/users/create` | Create a new user | Admin only |
| GET | `/users/<id>` | Get user by ID | Admin only |
| PATCH | `/users/<id>` | Update user role | Admin only |

### Projects

| Method | URL | Description | Auth |
|---|---|---|---|
| GET | `/projects` | List projects (non-admins: own/member only) | Required |
| POST | `/projects/create` | Create project | Admin / PM |
| GET | `/projects/<id>` | Get project | Admin / PM |
| PATCH | `/projects/<id>` | Update project | Admin / PM |
| DELETE | `/projects/<id>` | Delete project | Admin / PM |
| GET | `/projects/<id>/members` | List project members | Required |
| POST | `/projects/<id>/members/add` | Add member | Admin / PM |
| DELETE | `/projects/<id>/members/<user_id>` | Remove member | Admin / PM |
| GET | `/projects/<id>/active-sprint` | Get active sprint + its issues | Required |
| GET | `/projects/<id>/sprints` | List all sprints | Required |
| POST | `/projects/<id>/sprints` | Create sprint | Admin / PM |
| PATCH | `/sprints/<id>` | Update sprint status | Admin / PM |

### Issues

| Method | URL | Description | Auth |
|---|---|---|---|
| GET | `/projects/<id>/issues` | List project issues (filters: status, priority, assignee, sprint, backlog, label, search) | Required |
| POST | `/issues` | Create issue (auto-assigns to active sprint) | Admin / PM / Developer |
| GET | `/issues/<id>` | Get issue | Required |
| PATCH | `/issues/<id>` | Update issue | Required (viewer blocked; developer: own/assigned only) |
| DELETE | `/issues/<id>` | Delete issue | Admin / PM |
| GET | `/projects/<id>/labels` | List labels | Required |
| POST | `/projects/<id>/labels` | Create label | Admin / PM / Developer |

### Wiki

| Method | URL | Description | Auth |
|---|---|---|---|
| GET | `/projects/<id>/wiki` | List wiki pages (filters: space, parent, root_only, search) | Required |
| POST | `/wiki` | Create wiki page | Admin / PM / Developer |
| GET | `/wiki/<id>` | Get wiki page | Required |
| PATCH | `/wiki/<id>` | Update wiki page (auto-creates version snapshot) | Admin / PM / Developer |
| DELETE | `/wiki/<id>` | Delete page (cascades to children) | Admin / PM |
| GET | `/wiki/<id>/history` | Get version history | Required |
| POST | `/wiki/<id>/link-ticket` | Link an issue to this page | Required |

### Search

| Method | URL | Description | Auth |
|---|---|---|---|
| POST | `/search` | Global keyword search across issues and wiki | Required |

**Request body:**
```json
{ "query": "your search term" }
```

**Response:**
```json
[
  {
    "id": "<uuid>",
    "type": "issue",
    "title": "...",
    "excerpt": "...200 char snippet...",
    "projectId": "<uuid>"
  }
]
```

---

## Authentication & Authorization

### JWT Authentication

- Login at `POST /auth/login` with `{ "email": "...", "password": "..." }`
- Response includes `token` (access token) and the user object
- Include the token in all subsequent requests:
  ```
  Authorization: Bearer <token>
  ```
- Access token lifetime: **8 hours**
- Refresh token lifetime: **7 days**

### Token Payload

| Claim | Value |
|---|---|
| `user_id` | User UUID |
| Token type | `access` |

---

## Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|---|---|
| `admin` | Full access to everything |
| `pm` | Project & sprint management, issue management |
| `developer` | Create/edit issues and wiki pages (own/assigned only for edits) |
| `viewer` | Read-only access |

### Permission Classes

Defined in `users/permissions.py`:

| Class | Allowed Roles |
|---|---|
| `IsOrgAdmin` | admin |
| `IsAdminOrPM` | admin, pm |
| `CanCreateIssue` | admin, pm, developer |
| `CanWriteWiki` | admin, pm, developer |
| `CanDeleteIssue` | admin, pm |
| `ReadOnly` | Any authenticated (GET/HEAD/OPTIONS) |

### Developer Restrictions on Issues (PATCH)

Developers can only update issues where they are the `reporter` or `assignee`. Admin and PM can edit any issue.

---

## Key Business Logic

### Sprint Lifecycle

1. Sprint is created in `planned` status.
2. Transition to `active` — only allowed if no other sprint in the same project is already active.
3. Transition to `completed` — all unfinished issues (`status != done`) automatically move to the backlog (`sprint = null`).

### Issue Creation

- Creating an issue requires an active sprint in the project.
- The issue is automatically assigned to that active sprint.
- `reporter` is automatically set to the authenticated user.

### Backlog

Issues with `sprint = null` are in the backlog. Filter with `?backlog=true` on the issue list endpoint.

### Wiki Versioning

- Version 1 snapshot is created when a page is first saved.
- Every `PATCH` to a wiki page creates a new version snapshot (version number increments automatically).
- The full edit history is accessible at `GET /wiki/<id>/history`.

### Cascading Deletes

| Deleted | Cascades to |
|---|---|
| Project | All sprints, issues, labels, wiki spaces, wiki pages |
| WikiPage (parent) | All child pages recursively |
| Sprint | Issues are detached to backlog (SET_NULL), not deleted |

### Project Visibility

- Admins see all non-archived projects.
- PM and Developer users see only projects where they are the `owner` or a `ProjectMember`.
- Archived projects are excluded from list views by default.

---

## Search

`POST /search` performs a case-insensitive keyword search across:
- `Issue.title` and `Issue.description`
- `WikiPage.title` and `WikiPage.content`

Returns up to 20 results per type. Each result includes a 200-character contextual excerpt around the first match.

The endpoint interface is stable. The DS team will replace the internal PostgreSQL `icontains` implementation with a FastAPI semantic search endpoint without any changes to the API contract.

---

## Admin Interface

Django Admin is available at `/admin/`. Superuser credentials must be created manually (see [SETUP.md](SETUP.md)).

**Registered models:**

| App | Models |
|---|---|
| users | User |
| projects | Project, ProjectMember, Sprint |
| issues | Issue, Label |
| wiki | WikiPage, WikiPageVersion, TicketPageLink |

---

## Seed Data

A management command is available to populate the database with realistic test data:

```bash
python manage.py seed_data           # Seed once
python manage.py seed_data --clear   # Wipe existing data and reseed
```

**Test users created (all password: `Test1234!`):**

| Email | Role |
|---|---|
| admin@brainboard.com | admin |
| pm1@brainboard.com | pm |
| pm2@brainboard.com | pm |
| dev1@brainboard.com | developer |
| dev2@brainboard.com | developer |
| dev3@brainboard.com | developer |
| viewer@brainboard.com | viewer |

**Test projects:**

| Project | State |
|---|---|
| Alpha Platform | 1 completed sprint + 1 active sprint, 10+ issues |
| Beta Dashboard | 1 active sprint, 5+ issues |
| Gamma API | 1 planned sprint, 3 backlog issues (tests the "no active sprint" block) |
