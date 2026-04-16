# BrainBoard

A project management platform with Kanban boards, collaborative wiki pages, and AI-powered search. Built with React on the frontend and Django on the backend.

---

## Features

- **Projects Dashboard** — Create and browse projects; role-gated project creation for admins and PMs.
- **Kanban Board** — Drag-and-drop issue management across *To Do*, *In Progress*, and *Done* columns with story-point totals per column.
- **Issue Management** — Create, edit, and delete issues with priority levels (Critical / High / Medium / Low), assignees, and story points.
- **Wiki** — Per-project documentation with a nested sidebar and a live Markdown editor (split preview + edit).
- **AI Search** — Global `Cmd+K` / `Ctrl+K` command palette that searches across issues and wiki pages with 300 ms debounce.
- **Role-Based Access Control (RBAC)** — Four roles with granular permissions:

  | Permission       | Admin | PM | Developer | Viewer |
  |------------------|:-----:|:--:|:---------:|:------:|
  | Create project   | ✓     | ✓  |           |        |
  | Edit issue       | ✓     | ✓  | ✓         |        |
  | Delete issue     | ✓     | ✓  |           |        |
  | Move issue       | ✓     | ✓  | ✓         |        |
  | Create/edit wiki | ✓     | ✓  | ✓         |        |
  | Manage users     | ✓     |    |           |        |

- **User Management** — Admin-only page to view and manage all users.
- **Persistent Auth** — JWT token stored via Zustand + `localStorage`; protected routes redirect unauthenticated users to `/login`.

---

## Tech Stack

### Frontend (`/FE`)
| Library | Purpose |
|---|---|
| React 19 + TypeScript | UI framework |
| Vite 8 | Build tool & dev server |
| React Router v7 | Client-side routing |
| TanStack Query v5 | Server-state management & caching |
| Zustand v5 | Client-state (auth, UI) |
| Tailwind CSS v4 | Utility-first styling |
| `@hello-pangea/dnd` | Drag-and-drop for Kanban |
| `@uiw/react-md-editor` | Markdown editor with live preview |
| `cmdk` | Command palette (AI search) |
| Axios | HTTP client |

### Backend (`/BE`)
| Library | Purpose |
|---|---|
| Django | Web framework |
| Django REST Framework | REST API |
| Simple JWT | JWT authentication |
| django-cors-headers | CORS for FE dev server |

---

## Project Structure

```
BrainBoard/
├── FE/                         # React frontend
│   └── src/
│       ├── api/                # Axios API clients (issues, projects, wiki, search)
│       ├── components/
│       │   ├── common/         # Avatar, badges, skeletons, empty state
│       │   └── layout/         # AppShell, Sidebar, ProtectedRoute
│       ├── features/
│       │   ├── ai/             # AI search bar + useAISearch hook
│       │   ├── kanban/         # KanbanBoard, KanbanColumn, IssueCard, IssueModal
│       │   ├── projects/       # ProjectCard, CreateProjectModal
│       │   ├── users/          # UserTable
│       │   └── wiki/           # WikiEditor, WikiSidebar
│       ├── hooks/              # useRBAC
│       ├── lib/                # constants (permissions, colors), utils
│       ├── mocks/              # Static mock data for offline dev
│       ├── pages/              # DashboardPage, KanbanPage, WikiPage, LoginPage, UserManagementPage
│       ├── store/              # useAuthStore, useAppStore (Zustand)
│       └── types/              # Shared TypeScript interfaces
└── BE/                         # Django backend
    ├── config/
    │   ├── settings.py
    │   └── urls.py
    └── requirements.txt
```

---

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+

### Frontend

```bash
cd FE
npm install
npm run dev        # starts at http://localhost:5173
```

The frontend can run fully offline using mock data. Set `VITE_USE_MOCK=true` in `.env.development` (default).

**Environment variables (`FE/.env.development`):**
```env
VITE_USE_MOCK=true          # use mock data instead of real API
VITE_API_URL=http://localhost:8000
```

### Backend

```bash
cd BE
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver  # starts at http://localhost:8000
```

**Environment variables (`BE/.env`):** configure `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, and database settings as needed.

---

## Routes

| Path | Page | Access |
|---|---|---|
| `/login` | Login | Public |
| `/dashboard` | Projects list | Authenticated |
| `/projects/:id/kanban` | Kanban board | Authenticated |
| `/projects/:id/wiki` | Wiki editor | Authenticated |
| `/users` | User management | Admin only |

---

## Development Notes

- **Mock mode** — All API modules check `VITE_USE_MOCK`. When `true`, requests are served from `src/mocks/` so the UI is fully functional without a running backend.
- **Path aliases** — `@/` resolves to `FE/src/` (configured in `vite.config.ts`).
- **Lazy loading** — All page components are code-split via `React.lazy`.
- **RBAC hook** — Use `useRBAC()` anywhere in the component tree to gate UI by permission: `can('editIssue')`, `isAdmin()`, etc.

---

## Scripts

```bash
# Frontend
npm run dev       # development server
npm run build     # production build (TypeScript check + Vite)
npm run preview   # preview production build
npm run lint      # ESLint
```
