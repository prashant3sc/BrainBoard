# BrainBoard — Architecture Overview

> A Jira-style agile project management tool with integrated AI (RAG chatbot, task estimation, sprint analysis).

---

## Table of Contents

1. [Tech Stack Summary](#1-tech-stack-summary)
2. [Full File/Folder Tree](#2-full-filefolder-tree)
3. [Layer Connections](#3-layer-connections)
4. [Data Flow Diagrams](#4-data-flow-diagrams)
5. [Database Schema](#5-database-schema)
6. [API Reference Summary](#6-api-reference-summary)

---

## 1. Tech Stack Summary

| Layer           | Technology                       | Key Libraries / Notes                                                                                                                                           |
| --------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**    | React 19 + TypeScript + Vite     | Zustand (state), TanStack Query (server cache), Axios (HTTP), Tailwind CSS (styling), Tiptap (rich text), `@hello-pangea/dnd` (drag-drop), Recharts (analytics) |
| **Backend**     | Django 6 + Django REST Framework | `simplejwt` (JWT auth), `django-filter` (query params), `django-cors-headers`, Celery Beat (async tasks), `psycopg2` (PostgreSQL adapter)                       |
| **AI Service**  | FastAPI + LangChain              | OpenAI `gpt-4o-mini` (LLM), OpenAI `text-embedding-3-small` (embeddings), ChromaDB (vector store), Groq/LLaMA (optional), Pydantic v2, slowapi (rate limiting)  |
| **Database**    | PostgreSQL 16                    | Django ORM migrations, persistent Docker volume                                                                                                                 |
| **Async Tasks** | Celery Beat                      | Background document sync from Django → AI service                                                                                                               |
| **Containers**  | Docker Compose                   | 5 services: `db`, `pgadmin`, `be`, `ai`, `fe`                                                                                                                   |

---

## 2. Full File/Folder Tree

```
BrainBoard/
├── docker-compose.yml              # Main orchestration — all 5 services
├── docker-compose.client.yml       # Teammates config — connects to shared DB host
├── .env                            # Shared env vars (DB creds, API keys, secrets)
├── .env.client.example             # Template for new teammates
├── README.md                       # Setup guide
├── package.json                    # Root-level Node dependencies (minimal)
│
├── BE/                             # Django REST Backend
│   ├── Dockerfile                  # Python 3.12-slim image
│   ├── requirements.txt            # ~42 Python packages
│   ├── fix_requirements.py         # Fixes Windows UTF-16 encoding for Docker
│   ├── manage.py                   # Django CLI entry point
│   ├── seed_data.py                # Seeds DB with test users & sample data
│   │
│   └── jira_main/
│       ├── jira_main/
│       │   ├── settings.py         # Django config (DB, installed apps, JWT, CORS)
│       │   ├── urls.py             # Root URL router
│       │   ├── wsgi.py             # WSGI entry point
│       │   └── asgi.py             # ASGI entry point
│       │
│       ├── users/                  # User management app
│       │   ├── models.py           # Custom User model with role enum (Admin/PM/Dev/Viewer)
│       │   ├── views.py            # Auth endpoints (login, register, me, refresh)
│       │   ├── serializers.py      # User serialization (DRF)
│       │   └── urls.py             # /api/v1/auth/ and /api/v1/users/ routes
│       │
│       ├── projects/               # Project & sprint management app
│       │   ├── models.py           # Project, ProjectMember, Sprint models
│       │   ├── views.py            # CRUD endpoints for projects and sprints
│       │   ├── serializers.py      # Project/Sprint DRF serializers
│       │   └── urls.py             # /api/v1/projects/ routes
│       │
│       ├── issues/                 # Issue/ticket lifecycle app
│       │   ├── models.py           # Issue, Label, Comment models
│       │   ├── views.py            # Issue CRUD, batch ops, comment management
│       │   ├── serializers.py      # Issue/Comment DRF serializers
│       │   ├── filters.py          # DjangoFilter — status, priority, assignee, sprint, label
│       │   └── urls.py             # /api/v1/projects/{id}/issues/ routes
│       │
│       ├── wiki/                   # Knowledge base app
│       │   ├── models.py           # WikiSpace, WikiPage, WikiPageVersion models
│       │   ├── views.py            # Wiki CRUD with version history
│       │   ├── serializers.py      # Wiki DRF serializers
│       │   └── urls.py             # /api/v1/projects/{id}/wiki/ routes
│       │
│       ├── search/                 # Full-text search app
│       │   ├── models.py           # SearchIndex model
│       │   ├── views.py            # Full-text search endpoint
│       │   └── urls.py             # /api/v1/search/ route
│       │
│       └── ai_integration/         # AI service proxy & async sync layer
│           ├── ai_client.py        # HTTP client (requests) calling FastAPI on http://ai:8001
│           ├── page_context.py     # Extracts live page context (project/sprint/wiki state)
│           ├── classifier.py       # AI-powered issue classification helper
│           ├── prompts.py          # System prompts for AI proxy calls
│           ├── views.py            # Proxy endpoints — analyze-task, chatbot, sprint-pulse, sync
│           ├── tasks.py            # Celery tasks — async document embedding sync
│           ├── signals.py          # Django post_save signals → trigger Celery sync
│           └── urls.py             # /api/v1/ai/ routes
│
├── AI/                             # FastAPI AI Microservice
│   ├── Dockerfile                  # Python 3.10-slim, multi-stage build
│   ├── requirements.txt            # LangChain, ChromaDB, OpenAI, FastAPI, etc.
│   ├── seed_db.py                  # Populates ChromaDB from Postgres dump
│   ├── test_api.py                 # API testing utility
│   │
│   └── app/
│       ├── main.py                 # FastAPI app init, router registration, CORS
│       ├── config.py               # Settings via pydantic-settings (from .env)
│       ├── schemas.py              # Pydantic models for all request/response types
│       │
│       ├── core/
│       │   ├── logging.py          # Structured logging setup
│       │   ├── exceptions.py       # HTTP & validation exception handlers
│       │   └── security.py         # API key validation, CORS config
│       │
│       ├── routers/v1/             # API v1 route handlers
│       │   ├── chat.py             # POST /chat — read-only RAG chatbot
│       │   ├── chatbot.py          # POST /chatbot/query — project-scoped AI chat
│       │   ├── tasks.py            # POST /analyze-task — story point estimation
│       │   ├── team.py             # POST /team/upload-context & /team/full-sync
│       │   ├── sprint_pulse.py     # POST /sprint-pulse — sprint summary generation
│       │   ├── search.py           # POST /search — semantic vector search
│       │   ├── embed.py            # POST /embed — upsert document into ChromaDB
│       │   ├── chromadb.py         # POST /chromadb/query — direct vector DB queries
│       │   └── llm.py              # POST /llm/generate — raw LLM call
│       │
│       ├── services/               # Business logic layer
│       │   ├── rag_pipeline.py     # LLM factory, ChromaDB vector store, embeddings
│       │   ├── chat_service.py     # RAG chatbot logic
│       │   ├── chatbot_service.py  # Project-scoped multi-turn chatbot
│       │   ├── sprint_pulse_service.py  # Sprint analysis logic
│       │   └── agents/
│       │       └── base_agent.py   # Base agent class
│       │
│       ├── prompts/
│       │   └── task_prompts.py     # All LLM system/user prompt templates
│       │
│       └── chroma_db/              # Persisted ChromaDB vector index (Docker volume)
│
└── FE/                             # React + Vite Frontend
    ├── Dockerfile                  # Node 20-alpine, Vite dev server
    ├── package.json                # Node dependencies
    ├── tsconfig.json               # TypeScript config
    ├── vite.config.ts              # Vite bundler config
    ├── tailwind.config.ts          # Tailwind CSS config
    ├── index.html                  # HTML shell
    │
    └── src/
        ├── main.tsx                # React app bootstrap
        ├── App.tsx                 # Root component — routing, auth token sync
        │
        ├── api/                    # HTTP client layer
        │   ├── client.ts           # Axios instance with Bearer JWT interceptor
        │   ├── auth.ts             # Login, register, refresh token calls
        │   ├── projects.ts         # Project + sprint API calls
        │   ├── issues.ts           # Issue CRUD + comment API calls
        │   ├── wiki.ts             # Wiki page API calls
        │   ├── search.ts           # Search API calls
        │   ├── users.ts            # User list/CRUD API calls
        │   └── ai.ts               # AI proxy API calls (analyze, chatbot, sprint-pulse)
        │
        ├── pages/                  # Top-level route components
        │   ├── LoginPage.tsx       # Auth form
        │   ├── DashboardPage.tsx   # Project cards, overview stats
        │   ├── BacklogPage.tsx     # Sprint planning + issue backlog
        │   ├── KanbanPage.tsx      # Drag-drop kanban board
        │   ├── WikiPage.tsx        # Knowledge base viewer/editor
        │   ├── ProjectSettingsPage.tsx  # Project config & member management
        │   ├── UserManagementPage.tsx   # User CRUD + role assignment (admin)
        │   └── AnalyticsPage.tsx   # Charts, velocity, burndown
        │
        ├── components/             # Reusable UI components
        │   ├── common/             # Buttons, modals, cards, badges
        │   └── layout/             # AppShell, Sidebar, ProtectedRoute, Navbar
        │
        ├── features/               # Feature-specific components
        │   ├── IssueModal.tsx      # Create/edit issue dialog with AI story-point assist
        │   ├── ChatPanel.tsx       # AI chatbot sidebar (project-scoped)
        │   └── ...
        │
        ├── hooks/                  # Custom React hooks (TanStack Query wrappers)
        │   ├── useLabels.ts        # Label CRUD queries
        │   ├── useUsers.ts         # User queries
        │   └── ...
        │
        ├── store/                  # Zustand stores
        │   ├── useAuthStore.ts     # Token, user object, login/logout actions
        │   └── useAppStore.ts      # Theme, sidebar state, notifications
        │
        ├── types/                  # TypeScript interface definitions
        │   ├── user.ts             # User, Role types
        │   ├── project.ts          # Project, Sprint types
        │   └── issue.ts            # Issue, Label, Comment types
        │
        └── lib/                    # Utility helpers (dates, formatting, etc.)
```

---

## 3. Layer Connections

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (localhost:5173)                                        │
│  React 19 + TypeScript + Vite                                    │
│                                                                  │
│  Zustand ──► useAuthStore (JWT token, user object)               │
│  TanStack Query ──► caches server state per route                │
│  Axios client.ts ──► adds "Authorization: Bearer <token>"        │
└────────────────────────┬─────────────────────────────────────────┘
                         │  HTTP/REST  (localhost:8000)
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  Django 6 + DRF  (BE — port 8000)                                │
│                                                                  │
│  JWT middleware validates every request                          │
│  URL router → per-app ViewSets (users, projects, issues, wiki)   │
│  DjangoFilter → query param filtering on issues                  │
│  ai_integration app → proxies AI requests + adds page context    │
│  Celery Beat → async tasks (embedding sync after save)           │
└───────────┬──────────────────────────┬───────────────────────────┘
            │  PostgreSQL protocol     │  HTTP/REST  (http://ai:8001)
            ▼                          ▼
┌───────────────────┐    ┌─────────────────────────────────────────┐
│  PostgreSQL 16    │    │  FastAPI AI Service  (AI — port 8001)   │
│  (db — port 5432) │    │                                         │
│                   │    │  LangChain → builds RAG chains          │
│  users            │    │  ChromaDB  → vector similarity search   │
│  projects         │    │  OpenAI    → embeddings + LLM calls     │
│  sprints          │    │                                         │
│  issues           │    │  Endpoints:                             │
│  labels           │    │   /chat          RAG read chatbot       │
│  comments         │    │   /chatbot/query scoped AI assistant    │
│  wiki_pages       │    │   /analyze-task  story point estimation │
│  wiki_spaces      │    │   /sprint-pulse  sprint summary         │
│  wiki_versions    │    │   /embed         index document         │
│  search_index     │    │   /team/full-sync bulk re-index         │
└───────────────────┘    └─────────────────────────────────────────┘

Note: FE never calls AI directly. All AI traffic flows through Django.
```

---

## 4. Data Flow Diagrams

### 4a. Standard CRUD Request

```
User action (e.g. create issue)
        │
        ▼
FE: IssueModal.tsx calls api/issues.ts
        │
        ▼  POST /api/v1/projects/{id}/issues/
        │  { Authorization: Bearer <JWT> }
        ▼
BE: issues/views.py — IssueViewSet.create()
        │
        ├──► Validate payload via IssueSerializer
        │
        ├──► Save Issue to PostgreSQL
        │
        └──► Django post_save signal fires
                │
                ▼
             ai_integration/signals.py
                │
                ▼  Celery task enqueued (async)
             ai_integration/tasks.sync_document_to_ai()
                │
                ▼  POST http://ai:8001/api/v1/embed
             AI: embed.py → ChromaDB.upsert(issue_doc)

Response (201) ──► FE: TanStack Query cache invalidated
                       Kanban/Backlog re-fetches updated list
```

### 4b. AI Chatbot Request

```
User types message in ChatPanel.tsx
        │
        ▼
FE: api/ai.ts → POST /api/v1/ai/chatbot/query
        │  { query, project_id, sprint_id, page, history[] }
        ▼
BE: ai_integration/views.py
        │
        ├──► page_context.py: build page_context string
        │     (active sprint, issues summary, wiki titles, etc.)
        │
        └──► ai_client.py: POST http://ai:8001/api/v1/chatbot/query
                │  { query, project_id, history[], page_context }
                ▼
        AI: chatbot.py → chatbot_service.py
                │
                ├──► Build composite search query
                │     (query + page_context keywords)
                │
                ├──► ChromaDB.similarity_search(query, k=10)
                │     filter by project_id if provided
                │
                ├──► Assemble LLM prompt:
                │     [system_prompt]
                │     [retrieved context docs]
                │     [chat history]
                │     [current question]
                │
                └──► OpenAI GPT-4o-mini → { answer, sources[] }

Response ──► FE: ChatPanel renders answer + source chips
```

### 4c. Story Point Estimation (AI Task Analysis)

```
User clicks "Estimate" in IssueModal.tsx
        │
        ▼
FE: api/ai.ts → POST /api/v1/ai/analyze-task
        │  { heading, description, labels[] }
        ▼
BE: ai_integration/views.py → ai_client.analyze_task()
        │
        └──► POST http://ai:8001/api/v1/analyze-task
                │
                ▼
        AI: tasks.py → rag_pipeline.analyze_task_with_rag()
                │
                ├──► ChromaDB search for similar past issues
                │     (filter by matching labels)
                │
                ├──► Compute assignee frequency from results
                │
                └──► LLM call (json_mode=True):
                      prompt = TASK_ANALYSIS_PROMPT
                               + similar_issues_context

Response ──► {
  "story_points": 5,
  "justification": "Medium complexity backend task...",
  "required_roles": ["backend", "qa"],
  "recommended_team": { "backend": "alice", "qa": "bob" }
}
        │
        ▼
FE: IssueModal pre-fills story_points field
```

### 4d. Full Vector DB Sync

```
Admin triggers "Full Sync" or first-time setup
        │
        ▼
BE: ai_integration/views.py → POST /api/v1/ai/full-sync
        │
        ├──► Query all Issues, WikiPages, Users, Projects, Sprints
        │
        └──► POST http://ai:8001/api/v1/team/full-sync
                │  { issues: [...], wiki_pages: [...], ... }
                ▼
        AI: team.py → rag_pipeline.full_sync()
                │
                ├──► Clear existing ChromaDB collection
                │
                └──► For each document:
                      1. Format as text (title + body + metadata)
                      2. OpenAI embeddings API call
                      3. ChromaDB.upsert(id, embedding, metadata)

Result: Vector index rebuilt, all workspace data searchable
```

---

## 5. Database Schema

```
┌──────────────────┐        ┌──────────────────────┐
│ users_user       │        │ projects_project      │
│──────────────────│        │──────────────────────│
│ id (UUID) PK     │◄───────│ owner_id FK          │
│ email (unique)   │        │ id (UUID) PK          │
│ role (enum)      │        │ name                  │
│ first_name       │        │ description           │
│ last_name        │        │ is_archived           │
│ avatar_url       │        │ created_at            │
│ is_active        │        └──────────┬───────────┘
└──────────────────┘                   │
         ▲                             │ 1:many
         │                             ▼
         │              ┌──────────────────────┐
         │              │ projects_sprint       │
         │              │──────────────────────│
         │              │ id (UUID) PK          │
         │              │ project_id FK         │
         │              │ name                  │
         │              │ status (enum)         │
         │              │ start_date            │
         │              │ end_date              │
         │              └──────────┬───────────┘
         │                         │ 1:many
         │                         ▼
         │              ┌──────────────────────────┐
         │              │ issues_issue              │
         │              │──────────────────────────│
         │◄─────────────│ reporter_id FK            │
         │◄─────────────│ assignee_id FK (nullable) │
         │              │ id (UUID) PK              │
         │              │ project_id FK             │
         │              │ sprint_id FK (nullable)   │
         │              │ parent_id FK (self)       │
         │              │ title                     │
         │              │ description               │
         │              │ status (enum)             │
         │              │ priority (enum)           │
         │              │ issue_type (enum)         │
         │              │ story_points              │
         │              │ due_date                  │
         │              └──────┬────────┬───────────┘
         │                     │        │
         │              1:many │        │ M:M
         │                     ▼        ▼
         │      ┌──────────────────┐  ┌──────────────┐
         │      │ issues_comment   │  │ issues_label │
         │      │──────────────────│  │──────────────│
         │◄─────│ author_id FK     │  │ id (UUID) PK │
         │      │ id (UUID) PK     │  │ name         │
         │      │ ticket_id FK     │  │ color        │
         │      │ body             │  │ project_id FK│
         │      └──────────────────┘  └──────────────┘
         │
         │      ┌──────────────────────┐
         │      │ projects_member      │
         │◄─────│ user_id FK           │
         │      │ project_id FK        │
         │      │ joined_at            │
         │      └──────────────────────┘
         │
         │      ┌────────────────────────┐
         │      │ wiki_wikispace         │
         │      │────────────────────────│
         │◄─────│ created_by_id FK       │
         │      │ id (UUID) PK           │
         │      │ project_id FK          │
         │      │ name                   │
         │      └───────────┬────────────┘
         │                  │ 1:many
         │                  ▼
         │      ┌────────────────────────┐
         │      │ wiki_wikipage          │
         │      │────────────────────────│
         │◄─────│ created_by_id FK       │
         │◄─────│ updated_by_id FK       │
         │      │ id (UUID) PK           │
         │      │ project_id FK          │
         │      │ space_id FK (nullable) │
         │      │ parent_id FK (self)    │
         │      │ title                  │
         │      │ content                │
         │      └───────────┬────────────┘
         │                  │ 1:many
         │                  ▼
         │      ┌────────────────────────┐
         │◄─────│ wiki_wikipageversion   │
         │      │ id (UUID) PK           │
         │      │ page_id FK             │
         │      │ title (snapshot)       │
         │      │ content (snapshot)     │
         │      │ version_number         │
         │      └────────────────────────┘
```

---

## 6. API Reference Summary

### Authentication

| Method | Path                    | Description                                    |
| ------ | ----------------------- | ---------------------------------------------- |
| `POST` | `/api/v1/auth/login`    | Email + password → JWT access + refresh tokens |
| `POST` | `/api/v1/auth/register` | Create new user                                |
| `GET`  | `/api/v1/auth/me`       | Verify token, return current user              |
| `POST` | `/api/v1/auth/refresh`  | Exchange refresh token for new access token    |

### Users

| Method   | Path                  | Description                 |
| -------- | --------------------- | --------------------------- |
| `GET`    | `/api/v1/users/`      | List all users (admin only) |
| `GET`    | `/api/v1/users/{id}/` | Get user profile            |
| `PATCH`  | `/api/v1/users/{id}/` | Update user (admin or self) |
| `DELETE` | `/api/v1/users/{id}/` | Delete user (admin only)    |

### Projects & Sprints

| Method             | Path                                   | Description             |
| ------------------ | -------------------------------------- | ----------------------- |
| `GET/POST`         | `/api/v1/projects/`                    | List or create projects |
| `GET/PATCH/DELETE` | `/api/v1/projects/{id}/`               | Project detail          |
| `GET/POST`         | `/api/v1/projects/{id}/members/`       | Project members         |
| `GET/POST`         | `/api/v1/projects/{id}/sprints/`       | List or create sprints  |
| `GET/PATCH/DELETE` | `/api/v1/projects/{id}/sprints/{sid}/` | Sprint detail           |

### Issues

| Method             | Path                                           | Description                        |
| ------------------ | ---------------------------------------------- | ---------------------------------- |
| `GET/POST`         | `/api/v1/projects/{id}/issues/`                | List (filterable) or create issues |
| `GET/PATCH/DELETE` | `/api/v1/projects/{id}/issues/{iid}/`          | Issue detail                       |
| `GET/POST`         | `/api/v1/projects/{id}/issues/{iid}/comments/` | Comments                           |

**Issue filters:** `?status=`, `?priority=`, `?assignee_id=`, `?sprint_id=`, `?backlog=true`, `?label_id=`, `?search=`

### Wiki

| Method             | Path                                        | Description               |
| ------------------ | ------------------------------------------- | ------------------------- |
| `GET/POST`         | `/api/v1/projects/{id}/wiki/`               | List or create wiki pages |
| `GET/PATCH/DELETE` | `/api/v1/projects/{id}/wiki/{wid}/`         | Page detail               |
| `GET`              | `/api/v1/projects/{id}/wiki/{wid}/history/` | Version history           |

### Search

| Method | Path                             | Description                           |
| ------ | -------------------------------- | ------------------------------------- |
| `GET`  | `/api/v1/search/?q=&project_id=` | Full-text search across issues + wiki |

### AI (via Django proxy)

| Method | Path                       | Description                            |
| ------ | -------------------------- | -------------------------------------- |
| `POST` | `/api/v1/ai/analyze-task`  | Estimate story points + recommend team |
| `POST` | `/api/v1/ai/chatbot/query` | Project-scoped multi-turn AI chat      |
| `POST` | `/api/v1/ai/sprint-pulse`  | Generate sprint summary + highlights   |
| `POST` | `/api/v1/ai/full-sync`     | Rebuild entire ChromaDB vector index   |

### AI Service Direct (internal, port 8001)

| Method | Path                     | Description                       |
| ------ | ------------------------ | --------------------------------- |
| `GET`  | `/health`                | Health check                      |
| `POST` | `/api/v1/embed`          | Upsert a document into ChromaDB   |
| `POST` | `/api/v1/chromadb/query` | Direct vector similarity search   |
| `POST` | `/api/v1/team/full-sync` | Batch re-index all workspace data |
| `POST` | `/api/v1/llm/generate`   | Raw LLM call                      |
| `POST` | `/api/v1/search`         | Semantic search                   |
