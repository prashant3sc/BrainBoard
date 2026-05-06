# BrainBoard — Frontend Documentation

> React 19 + TypeScript + Vite SPA. State via Zustand (client) + TanStack Query (server). Styled with Tailwind CSS.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Routing](#3-routing)
4. [State Management](#4-state-management)
   - [useAuthStore](#41-useauthstore)
   - [useAppStore](#42-useappstore)
5. [API Client & Endpoints](#5-api-client--endpoints)
6. [Component Hierarchy](#6-component-hierarchy)
7. [Pages](#7-pages)
8. [Components](#8-components)
   - [Layout](#81-layout-components)
   - [Common / Shared](#82-common--shared-components)
   - [Feature: Issues & Kanban](#83-feature-issues--kanban)
   - [Feature: Projects](#84-feature-projects)
   - [Feature: Wiki](#85-feature-wiki)
   - [Feature: AI & Search](#86-feature-ai--search)
   - [Feature: Analytics](#87-feature-analytics)
9. [Custom Hooks](#9-custom-hooks)
10. [TypeScript Types](#10-typescript-types)
11. [Utilities & Constants](#11-utilities--constants)

---

## 1. Tech Stack

| Package | Version | Role |
|---|---|---|
| React | 19.2.4 | UI framework |
| TypeScript | 6.0.2 | Type safety |
| Vite | 8.0.4 | Dev server + bundler |
| react-router-dom | 7.14.0 | SPA routing |
| Zustand | 5.0.12 | Client-side state (auth, theme) |
| @tanstack/react-query | 5.96.2 | Server state, caching, mutations |
| Axios | 1.14.0 | HTTP client with auth interceptor |
| Tailwind CSS | 4.2.2 | Utility-first styling |
| @tiptap/react | 3.22.3 | Rich-text wiki editor |
| @hello-pangea/dnd | 18.0.1 | Kanban drag-and-drop |
| Recharts | 3.8.1 | Velocity + workload charts |
| cmdk | 1.1.1 | Command-palette search UI |

**Notable config:**
- `StrictMode` is intentionally disabled in `main.tsx` — `@hello-pangea/dnd` breaks under double-render.
- `vite.config.ts` sets alias `@` → `./src` and loads `.env` from the monorepo root (`../`), not `FE/`.
- `VITE_API_URL` env var controls the Django backend base URL (default `http://localhost:8000`).
- `VITE_USE_MOCK=true` swaps all API calls for local mock data (development shortcut).

---

## 2. Project Structure

```
FE/src/
├── main.tsx                  # React root — mounts App, no StrictMode
├── App.tsx                   # Router, QueryClientProvider, theme/auth init
├── index.css                 # Global styles, CSS custom properties (--bb-*)
│
├── api/                      # Axios call functions (one file per domain)
│   ├── client.ts             # Axios instance + Bearer token interceptor + 401 redirect
│   ├── auth.ts               # Login, logout, me, change-password
│   ├── projects.ts           # Project CRUD, members, ai-pulse
│   ├── issues.ts             # Issue CRUD + filter params
│   ├── sprints.ts            # Sprint list, active-sprint, status transitions
│   ├── wiki.ts               # Wiki CRUD, history, link-ticket
│   ├── users.ts              # User list, create, update role, delete
│   ├── labels.ts             # Label list, create, delete
│   ├── analytics.ts          # Velocity + workload endpoints
│   ├── search.ts             # Keyword search + semantic search
│   └── ai.ts                 # analyze-issue, analyze-draft, chat, sync
│
├── store/
│   ├── useAuthStore.ts       # Zustand: token, user, login, logout
│   └── useAppStore.ts        # Zustand: theme, palette, semantic search flag
│
├── pages/
│   ├── LoginPage.tsx
│   ├── DashboardPage.tsx
│   ├── BacklogPage.tsx
│   ├── KanbanPage.tsx
│   ├── WikiPage.tsx
│   ├── AnalyticsPage.tsx
│   ├── ProjectSettingsPage.tsx
│   └── UserManagementPage.tsx
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx      # Root layout: Sidebar + main content area
│   │   ├── Sidebar.tsx       # Collapsible nav with project-aware links
│   │   └── ProtectedRoute.tsx# Auth guard + optional permission check
│   └── common/
│       ├── Avatar.tsx
│       ├── EmptyState.tsx
│       ├── LoadingSkeleton.tsx
│       ├── PriorityBadge.tsx
│       └── RoleBadge.tsx
│
├── features/
│   ├── kanban/
│   │   ├── KanbanBoard.tsx
│   │   ├── KanbanColumn.tsx
│   │   ├── IssueCard.tsx
│   │   ├── IssueModal.tsx
│   │   ├── IssueListView.tsx
│   │   └── hooks/            # useIssues, useUpdateIssue, etc.
│   ├── projects/
│   │   ├── ProjectCard.tsx
│   │   ├── CreateProjectModal.tsx
│   │   ├── AiPulse.tsx
│   │   └── hooks/
│   ├── wiki/
│   │   ├── WikiSidebar.tsx
│   │   ├── WikiEditor.tsx
│   │   ├── WikiMetaSidebar.tsx
│   │   └── hooks/
│   ├── ai/
│   │   ├── SearchBar.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── SearchResults.tsx
│   │   ├── AIAnalysisPanel.tsx
│   │   └── hooks/
│   └── analytics/
│       ├── VelocityChart.tsx
│       ├── WorkloadChart.tsx
│       └── hooks/
│
├── hooks/
│   └── useRBAC.ts            # Role-based access control helper
│
├── types/
│   └── index.ts              # All shared TypeScript interfaces
│
├── lib/
│   ├── constants.ts          # PERMISSIONS map, PRIORITY_COLORS, STATUS_LABELS
│   └── utils.ts              # formatDate, getInitials, truncate, groupBy
│
└── mocks/
    └── mockData.ts           # Dev-only mock users, projects, issues, wiki pages
```

---

## 3. Routing

Defined in `App.tsx` using React Router v7.

```
/login                                 → LoginPage             (public)
/dashboard                             → DashboardPage         (protected)
/projects/:projectId/backlog           → BacklogPage           (protected)
/projects/:projectId/kanban            → KanbanPage            (protected)
/projects/:projectId/wiki              → WikiPage              (protected)
/projects/:projectId/analytics         → AnalyticsPage         (protected)
/projects/:projectId/settings          → ProjectSettingsPage   (protected, admin|pm)
/users                                 → UserManagementPage    (protected, admin only)
*                                      → redirect to /dashboard
```

All routes except `/login` are wrapped in `<ProtectedRoute>`. The `ProtectedRoute` component:
- Reads `isLoggedIn` from `useAuthStore`.
- Redirects to `/login` if not authenticated.
- Accepts an optional `requiredPermission` prop — redirects to `/dashboard` if the user's role lacks that permission.

**App.tsx startup effects:**
1. On mount, reads `token` from `useAuthStore` and calls `GET /auth/me` to rehydrate the user object (handles page refresh).
2. Reads theme from `useAppStore` and applies `dark` class to `<html>` when `theme === "dark"`.
3. Renders `<QueryClientProvider>` around the entire route tree.

---

## 4. State Management

The app uses **two separate Zustand stores**. All server data (issues, projects, sprints, etc.) lives in **TanStack Query cache** — not in Zustand.

### 4.1 `useAuthStore`

**File:** `store/useAuthStore.ts`  
**Persisted:** yes — via Zustand `persist` middleware to `localStorage` (key: `brainboard-auth`).

| Slice | Type | Description |
|---|---|---|
| `user` | `User \| null` | Currently authenticated user object |
| `token` | `string \| null` | JWT access token |
| `isLoggedIn` | `boolean` | Derived: `token !== null` |

| Action | Signature | Effect |
|---|---|---|
| `login` | `(user: User, token: string) => void` | Sets both `user` and `token` |
| `logout` | `() => void` | Clears `user` and `token`, redirects to `/login` |
| `setUser` | `(user: User) => void` | Updates user object (used after `/auth/me` rehydration) |

**Used in:**
- `App.tsx` — startup rehydration, theme init.
- `api/client.ts` — reads `token` to inject `Authorization` header.
- `ProtectedRoute` — reads `isLoggedIn`.
- `Sidebar` — reads `user` for avatar and role-gated nav items.
- `ProfileModal` — reads `user`, calls `setUser` after password change.

---

### 4.2 `useAppStore`

**File:** `store/useAppStore.ts`  
**Persisted:** yes — `localStorage` (key: `brainboard-app`).

| Slice | Type | Description |
|---|---|---|
| `theme` | `"light" \| "dark"` | Current colour theme |
| `paletteOpen` | `boolean` | Whether the ⌘K search palette is open |
| `semanticEnabled` | `boolean` | Toggles semantic (vector) vs keyword search |

| Action | Signature | Effect |
|---|---|---|
| `setTheme` | `(t: "light" \| "dark") => void` | Updates theme; caller toggles `dark` class on `<html>` |
| `togglePalette` | `() => void` | Flips `paletteOpen` |
| `toggleSemantic` | `() => void` | Flips `semanticEnabled` |

**Used in:**
- `App.tsx` — reads `theme` to apply `dark` CSS class.
- `SearchBar` — reads/writes `paletteOpen` and `semanticEnabled`.
- `Sidebar` / toolbar — theme toggle button.

---

## 5. API Client & Endpoints

### `api/client.ts`

Single Axios instance shared by all API modules.

```
baseURL  = VITE_API_URL ?? "http://localhost:8000"
headers  = { "Content-Type": "application/json" }
```

**Request interceptor:** reads `token` from `useAuthStore.getState()` and injects:
```
Authorization: Bearer <token>
```

**Response interceptor:** on `401` → calls `useAuthStore.getState().logout()` which clears state and navigates to `/login`.

---

### API modules & endpoints

#### `api/auth.ts`

| Function | Method | Path | When called |
|---|---|---|---|
| `login(email, password)` | POST | `/auth/login` | LoginPage submit |
| `logout()` | POST | `/auth/logout` | Sidebar logout button |
| `getMe()` | GET | `/auth/me` | App.tsx startup rehydration |
| `changePassword(current, new)` | PATCH | `/auth/me` | ProfileModal submit |

---

#### `api/projects.ts`

| Function | Method | Path | When called |
|---|---|---|---|
| `getProjects()` | GET | `/projects` | DashboardPage mount |
| `createProject(data)` | POST | `/projects/create` | CreateProjectModal submit |
| `updateProject(id, data)` | PATCH | `/projects/:id` | Edit project modal, archive toggle |
| `deleteProject(id)` | DELETE | `/projects/:id` | ProjectCard delete button |
| `getProjectMembers(projectId)` | GET | `/projects/:id/members` | ProjectSettingsPage, member lists |
| `addProjectMember(projectId, userId)` | POST | `/projects/:id/members/add` | ProjectSettingsPage add member |
| `removeProjectMember(projectId, userId)` | DELETE | `/projects/:id/members/:userId` | ProjectSettingsPage remove member |
| `getAiPulse(projectId)` | GET | `/projects/:id/ai-pulse` | AiPulse component mount |

---

#### `api/issues.ts`

| Function | Method | Path | Notes |
|---|---|---|---|
| `getIssues(projectId, filters)` | GET | `/projects/:id/issues` | Accepts status, priority, assignee_id, sprint_id, backlog, label_id, search |
| `createIssue(data)` | POST | `/issues` | IssueModal submit (create mode) |
| `updateIssue(id, data)` | PATCH | `/issues/:id` | IssueModal submit (edit), drag-drop status change |
| `deleteIssue(id)` | DELETE | `/issues/:id` | IssueModal delete button |

`dueDate` is mapped to `due_date` on the way out and back. Filter params are forwarded as query strings.

---

#### `api/sprints.ts`

| Function | Method | Path | When called |
|---|---|---|---|
| `getSprints(projectId)` | GET | `/projects/:id/sprints` | BacklogPage mount |
| `createSprint(projectId, data)` | POST | `/projects/:id/sprints` | BacklogPage "New Sprint" |
| `getActiveSprint(projectId, assigneeIds?)` | GET | `/projects/:id/active-sprint` | KanbanPage mount, filtered by member |
| `updateSprintStatus(id, status)` | PATCH | `/sprints/:id` | Start / Complete sprint buttons |

---

#### `api/wiki.ts`

| Function | Method | Path | When called |
|---|---|---|---|
| `getWikiPages(projectId, filters)` | GET | `/projects/:id/wiki` | WikiPage mount, WikiSidebar |
| `createWikiPage(data)` | POST | `/wiki` | WikiSidebar "New Page" |
| `updateWikiPage(id, data)` | PATCH | `/wiki/:id` | WikiEditor auto-save / manual save |
| `deleteWikiPage(id)` | DELETE | `/wiki/:id` | WikiSidebar delete |
| `getWikiHistory(id)` | GET | `/wiki/:id/history` | WikiMetaSidebar "History" tab |
| `getWikiLinks(id)` | GET | `/wiki/:id/link-ticket` | WikiMetaSidebar "Linked Issues" tab |
| `linkTicket(wikiId, issueId)` | POST | `/wiki/:id/link-ticket` | WikiMetaSidebar link form |
| `unlinkTicket(wikiId, issueId)` | DELETE | `/wiki/:id/link-ticket` | WikiMetaSidebar unlink button |

---

#### `api/users.ts`

| Function | Method | Path | When called |
|---|---|---|---|
| `getUsers()` | GET | `/users` | UserManagementPage, assignee dropdowns |
| `createUser(data)` | POST | `/users/create` | UserManagementPage "New User" modal |
| `updateUserRole(id, role)` | PATCH | `/users/:id` | UserManagementPage role dropdown |
| `deleteUser(id)` | DELETE | `/users/:id` | UserManagementPage delete button |

---

#### `api/labels.ts`

| Function | Method | Path | When called |
|---|---|---|---|
| `getLabels(projectId)` | GET | `/projects/:id/labels` | IssueModal label picker, ProjectSettingsPage |
| `createLabel(projectId, data)` | POST | `/projects/:id/labels` | ProjectSettingsPage Labels tab |
| `deleteLabel(projectId, labelId)` | DELETE | `/projects/:id/labels/:labelId` | ProjectSettingsPage Labels tab |

---

#### `api/analytics.ts`

| Function | Method | Path | When called |
|---|---|---|---|
| `getVelocity(projectId)` | GET | `/projects/:id/analytics/velocity` | AnalyticsPage, VelocityChart |
| `getWorkload(projectId)` | GET | `/projects/:id/analytics/workload` | AnalyticsPage, WorkloadChart |

---

#### `api/search.ts`

| Function | Method | Path | When called |
|---|---|---|---|
| `keywordSearch(query, projectId?)` | POST | `/search` | SearchBar (semantic off) |
| `semanticSearch(query, k?)` | POST | `/search/semantic` | SearchBar (semantic on) |

---

#### `api/ai.ts`

| Function | Method | Path | When called |
|---|---|---|---|
| `analyzeIssue(issueId)` | POST | `/ai/analyze-issue/:id` | IssueModal "Estimate" button (saved issue) |
| `analyzeDraft(title, desc, labels)` | POST | `/ai/analyze-draft` | IssueModal "Estimate" button (unsaved draft) |
| `chat(message, projectName?)` | POST | `/ai/chat` | ChatPanel send message |
| `syncAI()` | POST | `/ai/sync` | Admin sync button |
| `getSyncStatus()` | GET | `/ai/sync/status` | Admin sync status display |

---

## 6. Component Hierarchy

```
App
└── QueryClientProvider
    └── Router
        ├── /login → LoginPage
        └── ProtectedRoute
            └── AppShell
                ├── Sidebar
                │   └── ProfileModal (conditionally rendered)
                ├── SearchBar (palette overlay)
                │   └── SearchResults
                ├── ChatPanelWrapper
                │   └── ChatPanel
                └── <Outlet> (page content)
                    │
                    ├── DashboardPage
                    │   ├── ProjectCard (× N)
                    │   │   └── AiPulse (conditionally)
                    │   └── CreateProjectModal
                    │
                    ├── BacklogPage
                    │   ├── SprintSection (× N active/planned sprints)
                    │   │   └── IssueCard (× N)
                    │   ├── BacklogSection
                    │   │   └── IssueCard (× N)
                    │   └── IssueModal (create/edit)
                    │
                    ├── KanbanPage
                    │   ├── KanbanBoard (drag-drop context)
                    │   │   └── KanbanColumn (× 4 statuses)
                    │   │       └── IssueCard (× N)
                    │   ├── IssueListView (toggled alternative to board)
                    │   └── IssueModal (create/edit)
                    │
                    ├── WikiPage
                    │   ├── WikiSidebar (page tree)
                    │   ├── WikiEditor (TipTap)
                    │   └── WikiMetaSidebar
                    │       ├── Version history list
                    │       └── Linked issues list
                    │
                    ├── AnalyticsPage
                    │   ├── VelocityChart
                    │   └── WorkloadChart
                    │
                    ├── ProjectSettingsPage
                    │   ├── Members tab
                    │   │   └── ProjectMemberRow (× N)
                    │   └── Labels tab
                    │       └── LabelRow (× N)
                    │
                    └── UserManagementPage
                        └── UserRow (× N)
```

---

## 7. Pages

### `LoginPage`

**Route:** `/login`  
**Auth:** public (redirect to `/dashboard` if already logged in)

**State (local):**
- `email: string`
- `password: string`
- `loading: boolean`
- `error: string | null`
- `selectedMockUser: string` — dev-mode quick-login dropdown

**Renders:** Email input, password input, submit button. In dev mode shows a dropdown of mock users for one-click login.

**API calls:**
- `POST /auth/login` on form submit → stores token + user in `useAuthStore.login()` → navigates to `/dashboard`.

---

### `DashboardPage`

**Route:** `/dashboard`

**State (local):**
- `activeTab: "active" | "archived"`
- `showCreateModal: boolean`
- `editingProject: Project | null`
- `pulseProjectId: string | null` — which project's AI pulse is expanded

**Renders:** Tabs (Active / Archived), grid of `<ProjectCard>`, `<CreateProjectModal>`.

**API calls (via hooks):**
- `useProjects()` — GET `/projects` on mount; re-fetches on tab change.
- `useCreateProject()` — POST `/projects/create` from modal.
- `useUpdateProject()` — PATCH `/projects/:id` from edit modal.
- `useArchiveProject()` — PATCH `/projects/:id` with `{ isArchived: true }`.
- `useDeleteProject()` — DELETE `/projects/:id`.

---

### `BacklogPage`

**Route:** `/projects/:projectId/backlog`

**State (local):**
- `showIssueModal: boolean`
- `editingIssue: Issue | null`
- `selectedSprint: string | "backlog"` — which sprint section is expanded
- `newSprintName: string`

**Renders:** List of sprint sections (planned + active sprints) each with their issues, then a Backlog section with unassigned issues. "New Sprint" button. `<IssueModal>` overlay.

**API calls (via hooks):**
- `useSprints(projectId)` — GET `/projects/:id/sprints`.
- `useIssues(projectId, { sprintId })` — GET `/projects/:id/issues?sprint_id=...` per section; backlog section uses `?backlog=true`.
- `useCreateSprint()` — POST `/projects/:id/sprints`.
- `useStartSprint()` — PATCH `/sprints/:id` `{ status: "active" }`.
- `useCompleteSprint()` — PATCH `/sprints/:id` `{ status: "completed" }`.
- `useCreateIssue()` / `useUpdateIssue()` / `useDeleteIssue()` — through IssueModal.

---

### `KanbanPage`

**Route:** `/projects/:projectId/kanban`

**State (local):**
- `viewMode: "board" | "list"` — toggle between KanbanBoard and IssueListView
- `selectedAssignees: string[]` — multi-member filter chips
- `search: string` — inline issue search
- `showIssueModal: boolean`
- `editingIssue: Issue | null`

**Renders:** Toolbar (view toggle, member filter chips, search input), then either `<KanbanBoard>` or `<IssueListView>`. `<IssueModal>` overlay.

**API calls (via hooks):**
- `useActiveSprint(projectId, selectedAssignees)` — GET `/projects/:id/active-sprint?assignee_ids=...`.
- `useProjectMembers(projectId)` — GET `/projects/:id/members` (for filter chips).
- `useUpdateIssue()` — PATCH `/issues/:id` on drag-drop column change.

---

### `WikiPage`

**Route:** `/projects/:projectId/wiki`

**State (local):**
- `selectedPageId: string | null`
- `isEditing: boolean`

**Renders:** Three-column layout — `<WikiSidebar>` (tree) | `<WikiEditor>` (content) | `<WikiMetaSidebar>` (metadata).

**API calls (via hooks):**
- `useWikiPages(projectId)` — GET `/projects/:id/wiki`.
- `useCreateWikiPage()` — POST `/wiki`.
- `useUpdateWikiPage()` — PATCH `/wiki/:id`.
- `useDeleteWikiPage()` — DELETE `/wiki/:id`.
- `useWikiHistory(pageId)` — GET `/wiki/:id/history` (lazy, only when metadata panel opened).
- `useWikiLinks(pageId)` — GET `/wiki/:id/link-ticket`.
- `useLinkTicket()` / `useUnlinkTicket()` — POST/DELETE `/wiki/:id/link-ticket`.

---

### `AnalyticsPage`

**Route:** `/projects/:projectId/analytics`

**State (local):** minimal — chart display is driven by query data.

**Renders:** `<VelocityChart>` and `<WorkloadChart>` side by side.

**API calls (via hooks):**
- `useVelocity(projectId)` — GET `/projects/:id/analytics/velocity`.
- `useWorkload(projectId)` — GET `/projects/:id/analytics/workload`.

---

### `ProjectSettingsPage`

**Route:** `/projects/:projectId/settings`  
**Permission:** `can_manage_projects` (admin or PM)

**State (local):**
- `activeTab: "members" | "labels"`
- `addMemberEmail: string`
- `newLabelName: string`, `newLabelColor: string`

**Renders:** Tab switcher. Members tab: list of `ProjectMemberRow` with remove button + "Add member" form. Labels tab: list of `LabelRow` with delete + "Create label" form.

**API calls (via hooks):**
- `useProjectMembers(projectId)`.
- `useAddMember()` — POST `/projects/:id/members/add`.
- `useRemoveMember()` — DELETE `/projects/:id/members/:userId`.
- `useLabels(projectId)` — GET `/projects/:id/labels`.
- `useCreateLabel()` — POST `/projects/:id/labels`.
- `useDeleteLabel()` — DELETE `/projects/:id/labels/:labelId`.

---

### `UserManagementPage`

**Route:** `/users`  
**Permission:** admin only (`IsOrgAdmin`)

**State (local):**
- `showCreateModal: boolean`
- `newUser: { email, password, firstName, lastName, role }`

**Renders:** Table of all users with inline role dropdown, delete button. "New User" modal.

**API calls (via hooks):**
- `useUsers()` — GET `/users`.
- `useCreateUser()` — POST `/users/create`.
- `useUpdateUserRole()` — PATCH `/users/:id` `{ role }`.
- `useDeleteUser()` — DELETE `/users/:id`.

---

## 8. Components

### 8.1 Layout Components

#### `AppShell`

**File:** `components/layout/AppShell.tsx`

**Props:** none (reads everything from stores and router)

**Renders:**
```
<div class="flex h-screen">
  <Sidebar />
  <div class="flex-1 flex flex-col overflow-hidden">
    <SearchBar />                  ← palette overlay (⌘K)
    <main>
      <Outlet />                   ← page content
    </main>
    <ChatPanelWrapper>
      <ChatPanel />
    </ChatPanelWrapper>
  </div>
</div>
```

No local state — purely structural.

---

#### `Sidebar`

**File:** `components/layout/Sidebar.tsx`

**Props:** none

**Local state:**
- `collapsed: boolean` — toggles between 52 px and 232 px width.
- `showProfileModal: boolean`

**Renders:**
- Logo / collapse toggle button.
- Navigation links:
  - Dashboard (always shown)
  - Kanban — active only when inside a project route
  - Backlog — same
  - Wiki — same
  - Analytics — same
  - Settings — shown only if `can_manage_projects`
  - User Management — shown only if `is_org_admin`
- When collapsed, nav items show icon + tooltip only.
- User avatar at bottom → opens `<ProfileModal>`.
- Theme toggle button.
- Logout button.

**Reads from:** `useAuthStore` (user, logout), `useAppStore` (theme, setTheme), `useParams` (projectId for nav links).

---

#### `ProtectedRoute`

**File:** `components/layout/ProtectedRoute.tsx`

**Props:**
```ts
{
  children: ReactNode
  requiredPermission?: keyof typeof PERMISSIONS
}
```

**Logic:**
1. If `!isLoggedIn` → `<Navigate to="/login" />`.
2. If `requiredPermission` provided and `!useRBAC(requiredPermission)` → `<Navigate to="/dashboard" />`.
3. Otherwise renders `children`.

---

#### `ProfileModal`

**File:** `components/layout/ProfileModal.tsx`

**Props:**
```ts
{ isOpen: boolean; onClose: () => void }
```

**Local state:**
- `currentPassword: string`
- `newPassword: string`
- `showCurrent: boolean`, `showNew: boolean` — toggle password visibility
- `error: string | null`
- `success: string | null`

**API calls:** `PATCH /auth/me` with `{ currentPassword, newPassword }` on submit. On success calls `useAuthStore.setUser()` with updated user.

---

### 8.2 Common / Shared Components

#### `Avatar`

**Props:**
```ts
{
  user: { name: string; avatarUrl?: string | null }
  size?: "sm" | "md" | "lg"   // default "md"
}
```

Renders `<img>` if `avatarUrl` is set; otherwise a circle with initials (via `getInitials(name)`) and a deterministic background colour derived from hashing the name string.

---

#### `EmptyState`

**Props:**
```ts
{
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}
```

Renders centred illustration, title, description, optional CTA button.

---

#### `LoadingSkeleton`

**Props:**
```ts
{ rows?: number }   // default 3
```

Renders animated pulse placeholder rows.

---

#### `PriorityBadge`

**Props:**
```ts
{ priority: Priority }   // "critical" | "high" | "medium" | "low"
```

Renders a coloured pill using `PRIORITY_COLORS` from `lib/constants.ts`.

---

#### `RoleBadge`

**Props:**
```ts
{ role: Role }   // "admin" | "pm" | "developer" | "viewer"
```

Renders a styled badge with role label.

---

### 8.3 Feature: Issues & Kanban

#### `KanbanBoard`

**File:** `features/kanban/KanbanBoard.tsx`

**Props:**
```ts
{
  issues: Issue[]
  onIssueClick: (issue: Issue) => void
  onStatusChange: (issueId: string, newStatus: IssueStatus) => void
}
```

**Local state:** none — fully controlled.

**Renders:** `<DragDropContext>` from `@hello-pangea/dnd` wrapping 4 `<KanbanColumn>` components (one per status: `todo`, `in_progress`, `review`, `done`).

**Drag-drop logic:**
- `onDragEnd` callback computes source/destination column.
- Calls `onStatusChange(issueId, destinationColumn)` which triggers `useUpdateIssue` with optimistic update.
- No local reordering — order is determined by server `created_at` ordering.

---

#### `KanbanColumn`

**File:** `features/kanban/KanbanColumn.tsx`

**Props:**
```ts
{
  status: IssueStatus
  issues: Issue[]
  onIssueClick: (issue: Issue) => void
}
```

**Renders:** Column header (status label + issue count), `<Droppable>` zone, list of `<IssueCard>` inside `<Draggable>` wrappers, `<LoadingSkeleton>` while loading.

---

#### `IssueCard`

**File:** `features/kanban/IssueCard.tsx`

**Props:**
```ts
{
  issue: Issue
  onClick: () => void
  isDragging?: boolean
}
```

**Renders:** Card with:
- Issue type icon (task / subtask / bug)
- Title (truncated)
- Priority badge
- Label chips
- Assignee avatar
- Story points (if set)
- Due date (highlighted red if past due)
- Subtask progress bar (if subtasks exist: `doneSubtaskCount / subtaskCount`)

No local state.

---

#### `IssueModal`

**File:** `features/kanban/IssueModal.tsx`

**Props:**
```ts
{
  isOpen: boolean
  onClose: () => void
  issue?: Issue | null        // null = create mode
  projectId: string
  sprintId?: string           // pre-selects sprint if creating from sprint section
}
```

**Local state:**
- All form fields: `title`, `description`, `status`, `priority`, `issueType`, `storyPoints`, `dueDate`, `assigneeId`, `sprintId`, `parentId`, `labelIds`
- `aiAnalysis: AIAnalysisResult | null`
- `aiLoading: boolean`
- `tab: "details" | "comments" | "subtasks"`

**Renders:**
- Create or edit form with all issue fields.
- Rich text description (plain textarea — TipTap is used in Wiki only).
- Label multi-select picker.
- Assignee dropdown (from `useUsers()`).
- Sprint dropdown (from `useSprints(projectId)`).
- "Estimate with AI" button → calls `analyzeIssue(issueId)` or `analyzeDraft(title, desc, labels)` depending on whether issue is saved.
- AI analysis result panel: story points, justification, recommended team.
- Tabs for Comments and Subtasks (edit mode only).
- Delete button (admin/PM only).

**API calls:**
- `useCreateIssue()` / `useUpdateIssue()` / `useDeleteIssue()`.
- `useUsers()` for assignee dropdown.
- `useSprints(projectId)` for sprint dropdown.
- `useLabels(projectId)` for label picker.
- `POST /ai/analyze-issue/:id` or `POST /ai/analyze-draft` on "Estimate" click.

---

#### `IssueListView`

**File:** `features/kanban/IssueListView.tsx`

**Props:**
```ts
{
  issues: Issue[]
  onIssueClick: (issue: Issue) => void
}
```

**Renders:** Table with columns: Type, Title, Priority, Status, Assignee, Story Points, Due Date. Click row opens IssueModal. Sortable by column header click (client-side sort only).

---

### 8.4 Feature: Projects

#### `ProjectCard`

**File:** `features/projects/ProjectCard.tsx`

**Props:**
```ts
{
  project: Project
  onEdit: (project: Project) => void
  onArchive: (project: Project) => void
  onDelete: (project: Project) => void
  onPulse: (projectId: string) => void
}
```

**Renders:**
- Project name, description.
- Member avatar stack (up to 5, then "+N more").
- Action menu (three-dot) with: Edit, Archive/Unarchive, Delete.
- "AI Pulse" button → calls `onPulse(projectId)`.
- Navigation links: Kanban, Backlog, Wiki, Analytics.

No local state.

---

#### `CreateProjectModal`

**File:** `features/projects/CreateProjectModal.tsx`

**Props:**
```ts
{
  isOpen: boolean
  onClose: () => void
  editProject?: Project | null    // null = create mode
}
```

**Local state:** `name: string`, `description: string`.

**API calls:** `useCreateProject()` or `useUpdateProject()` depending on `editProject`.

---

#### `AiPulse`

**File:** `features/projects/AiPulse.tsx`

**Props:**
```ts
{ projectId: string }
```

**Local state:** none — fully driven by `useAiPulse(projectId)`.

**Renders:**
- Sprint metadata (name, dates).
- Stats grid: total issues, done, in-progress, todo; story points done / total.
- Team bandwidth list (name, open count, high-priority count).
- AI-generated summary paragraph.
- Highlight chips (text + tag like "risk" / "info").
- Loading skeleton while fetching.

**API calls:** `useAiPulse(projectId)` → GET `/projects/:id/ai-pulse`.

---

### 8.5 Feature: Wiki

#### `WikiSidebar`

**File:** `features/wiki/WikiSidebar.tsx`

**Props:**
```ts
{
  projectId: string
  selectedPageId: string | null
  onSelectPage: (pageId: string) => void
}
```

**Local state:**
- `expandedNodes: Set<string>` — tracks which parent pages are open in tree.
- `newPageTitle: string`

**Renders:**
- Tree of wiki pages (nested by `parentId`). Each node has expand/collapse chevron, title, delete button.
- "New Page" input at bottom.

**API calls:** `useWikiPages(projectId)`, `useCreateWikiPage()`, `useDeleteWikiPage()`.

---

#### `WikiEditor`

**File:** `features/wiki/WikiEditor.tsx`

**Props:**
```ts
{
  page: WikiPage | null
  isEditing: boolean
  onSave: (content: string, title: string) => void
}
```

**Local state:**
- TipTap editor instance (via `useEditor()`)
- `title: string`
- `hasChanges: boolean`

**TipTap extensions configured:**
`StarterKit`, `Heading` (H1–H6), `Bold`, `Italic`, `Underline`, `Link`, `Image`, `Table`, `TableRow`, `TableCell`, `TableHeader`, `TaskList`, `TaskItem`, `TextAlign`, `Highlight`, `Placeholder`

**Renders:**
- Title input (editable when `isEditing`).
- Toolbar (bold, italic, underline, headings, link, image, table, task list, text alignment) — hidden in read-only mode.
- TipTap editor canvas.
- "Save" button (calls `onSave`) — shown only when `isEditing && hasChanges`.

---

#### `WikiMetaSidebar`

**File:** `features/wiki/WikiMetaSidebar.tsx`

**Props:**
```ts
{
  page: WikiPage | null
  projectId: string
}
```

**Local state:**
- `activeTab: "info" | "history" | "links"`
- `linkIssueId: string`

**Renders:**
- Info tab: created by, created at, updated at, updated by.
- History tab: list of version snapshots from `useWikiHistory(page.id)` — version number, author, timestamp.
- Links tab: linked issues from `useWikiLinks(page.id)`, input to link a new issue by ID, unlink buttons.

---

### 8.6 Feature: AI & Search

#### `SearchBar`

**File:** `features/ai/SearchBar.tsx`

**Props:** none

**Local state:**
- `query: string`
- `open: boolean` (synced with `useAppStore.paletteOpen`)

**Keyboard shortcut:** `⌘K` / `Ctrl+K` toggles palette open.

**Renders:**
- Trigger button (search icon + shortcut hint).
- `cmdk` `<Command>` palette overlay when open.
- Semantic toggle switch (reads `useAppStore.semanticEnabled`).
- Results via `useAISearch(query)` — shows issues and wiki pages with icons.

**API calls (via `useAISearch`):**
- Keyword: `POST /search` — debounced 300 ms.
- Semantic: `POST /search/semantic` — debounced 500 ms.

---

#### `ChatPanel`

**File:** `features/ai/ChatPanel.tsx`

**Props:** none (reads projectId from route params)

**Local state (via `useAIChat`):**
- `messages: { role: "user" | "assistant"; content: string; sources?: Source[] }[]`
- `input: string`
- `loading: boolean`

**Renders:**
- Collapsible panel anchored to bottom-right of AppShell.
- Message thread (user bubbles right, assistant left).
- Source citation chips below assistant messages (clickable → navigate to issue/wiki page).
- Text input + send button.

**API calls:** `POST /ai/chat` on each message send. Response appended to `messages` array.

---

#### `SearchResults`

**File:** `features/ai/SearchResults.tsx`

**Props:**
```ts
{
  results: SearchResult[]
  onSelect: (result: SearchResult) => void
}
```

Renders grouped list (Issues / Wiki Pages) with icon, title, excerpt. No local state.

---

#### `AIAnalysisPanel`

**File:** `features/ai/AIAnalysisPanel.tsx`

**Props:**
```ts
{
  analysis: AIAnalysisResult | null
  loading: boolean
}
```

**Renders:**
- Loading spinner when `loading`.
- Story points badge.
- Justification paragraph.
- Required roles list.
- Capacity analysis text.
- Recommended team table (role → matched user name + avatar).

No local state.

---

### 8.7 Feature: Analytics

#### `VelocityChart`

**File:** `features/analytics/VelocityChart.tsx`

**Props:**
```ts
{ projectId: string }
```

**Renders:** Recharts `<BarChart>` — one bar group per completed sprint showing `committed` vs `completed` story points, line overlay for `completionRate`.

**API calls:** `useVelocity(projectId)` → GET `/projects/:id/analytics/velocity`.

---

#### `WorkloadChart`

**File:** `features/analytics/WorkloadChart.tsx`

**Props:**
```ts
{ projectId: string }
```

**Renders:** Recharts `<BarChart>` — one bar per team member, stacked by issue status (todo / in_progress / review).

**API calls:** `useWorkload(projectId)` → GET `/projects/:id/analytics/workload`.

---

## 9. Custom Hooks

All server-state hooks use TanStack Query. Mutation hooks invalidate the relevant query cache key on success so pages re-render automatically.

### Auth & RBAC

#### `useRBAC(permission)`

**File:** `hooks/useRBAC.ts`

Reads `user.role` from `useAuthStore` and checks against the `PERMISSIONS` map in `lib/constants.ts`. Returns `boolean`.

```ts
PERMISSIONS = {
  manageProjects:   ["admin", "pm"],
  createIssues:     ["admin", "pm", "developer"],
  writeWiki:        ["admin", "pm", "developer"],
  manageUsers:      ["admin"],
  viewAnalytics:    ["admin", "pm", "developer", "viewer"],
}
```

---

### Project hooks (`features/projects/hooks/`)

| Hook | Query key | API call | Notes |
|---|---|---|---|
| `useProjects()` | `["projects"]` | GET `/projects` | |
| `useCreateProject()` | — | POST `/projects/create` | Invalidates `["projects"]` |
| `useUpdateProject()` | — | PATCH `/projects/:id` | Invalidates `["projects"]` |
| `useArchiveProject()` | — | PATCH `/projects/:id` | Shorthand wrapper around updateProject |
| `useDeleteProject()` | — | DELETE `/projects/:id` | Invalidates `["projects"]` |
| `useProjectMembers(projectId)` | `["members", projectId]` | GET `/projects/:id/members` | |
| `useAddMember()` | — | POST `/projects/:id/members/add` | Invalidates `["members", projectId]` |
| `useRemoveMember()` | — | DELETE `/projects/:id/members/:userId` | Invalidates `["members", projectId]` |
| `useAiPulse(projectId)` | `["ai-pulse", projectId]` | GET `/projects/:id/ai-pulse` | `staleTime: 5 min` |

---

### Sprint hooks (`features/kanban/hooks/` or `features/projects/hooks/`)

| Hook | Query key | API call |
|---|---|---|
| `useSprints(projectId)` | `["sprints", projectId]` | GET `/projects/:id/sprints` |
| `useActiveSprint(projectId, assigneeIds)` | `["active-sprint", projectId, assigneeIds]` | GET `/projects/:id/active-sprint` |
| `useCreateSprint()` | — | POST `/projects/:id/sprints` → invalidates `["sprints", projectId]` |
| `useStartSprint()` | — | PATCH `/sprints/:id` `{ status: "active" }` → invalidates sprints |
| `useCompleteSprint()` | — | PATCH `/sprints/:id` `{ status: "completed" }` → invalidates sprints + issues |

---

### Issue hooks (`features/kanban/hooks/`)

| Hook | Query key | API call | Notes |
|---|---|---|---|
| `useIssues(projectId, filters)` | `["issues", projectId, filters]` | GET `/projects/:id/issues` | filters as query params |
| `useCreateIssue()` | — | POST `/issues` | Invalidates `["issues", projectId]` |
| `useUpdateIssue()` | — | PATCH `/issues/:id` | **Optimistic update** — applies new status/fields immediately, rolls back on error |
| `useDeleteIssue()` | — | DELETE `/issues/:id` | Invalidates `["issues", projectId]` |

`useUpdateIssue` optimistic update pattern:
```
onMutate  → snapshot current cache → apply update locally
onError   → restore snapshot
onSettled → invalidate query (re-fetch from server)
```

---

### Label hooks

| Hook | Query key | API call |
|---|---|---|
| `useLabels(projectId)` | `["labels", projectId]` | GET `/projects/:id/labels` |
| `useCreateLabel()` | — | POST `/projects/:id/labels` → invalidates labels |
| `useDeleteLabel()` | — | DELETE `/projects/:id/labels/:id` → invalidates labels |

---

### User hooks (`features/` or `hooks/`)

| Hook | Query key | API call | Notes |
|---|---|---|---|
| `useUsers()` | `["users"]` | GET `/users` | |
| `useCreateUser()` | — | POST `/users/create` | Invalidates `["users"]` |
| `useUpdateUserRole()` | — | PATCH `/users/:id` | **Optimistic update** |
| `useDeleteUser()` | — | DELETE `/users/:id` | Invalidates `["users"]` |

---

### Wiki hooks (`features/wiki/hooks/`)

| Hook | Query key | API call |
|---|---|---|
| `useWikiPages(projectId, filters?)` | `["wiki", projectId]` | GET `/projects/:id/wiki` |
| `useCreateWikiPage()` | — | POST `/wiki` → invalidates wiki |
| `useUpdateWikiPage()` | — | PATCH `/wiki/:id` → invalidates wiki |
| `useDeleteWikiPage()` | — | DELETE `/wiki/:id` → invalidates wiki |
| `useWikiHistory(pageId)` | `["wiki-history", pageId]` | GET `/wiki/:id/history` |
| `useWikiLinks(pageId)` | `["wiki-links", pageId]` | GET `/wiki/:id/link-ticket` |
| `useLinkTicket()` | — | POST `/wiki/:id/link-ticket` → invalidates wiki-links |
| `useUnlinkTicket()` | — | DELETE `/wiki/:id/link-ticket` → invalidates wiki-links |

---

### Analytics hooks (`features/analytics/hooks/`)

| Hook | Query key | API call |
|---|---|---|
| `useVelocity(projectId)` | `["velocity", projectId]` | GET `/projects/:id/analytics/velocity` |
| `useWorkload(projectId)` | `["workload", projectId]` | GET `/projects/:id/analytics/workload` |

---

### AI hooks (`features/ai/hooks/`)

#### `useAIChat()`

Manages conversation history locally (not in TanStack Query — messages are ephemeral).

| State | Type |
|---|---|
| `messages` | `ChatMessage[]` |
| `loading` | `boolean` |

`sendMessage(text)` → appends user message → calls `POST /ai/chat` → appends assistant response with `sources`.

---

#### `useAISearch(query)`

| Behaviour | Detail |
|---|---|
| Keyword mode | Calls `POST /search`, debounced 300 ms |
| Semantic mode | Calls `POST /search/semantic`, debounced 500 ms |
| Mode toggle | Reads `useAppStore.semanticEnabled` |
| Returns | `{ results: SearchResult[]; isLoading: boolean }` |

---

#### `useAIAnalysis()`

Returns `{ analyze, result, loading }`.

`analyze(issue?: Issue, draft?: DraftIssue)`:
- If `issue` has an ID → `POST /ai/analyze-issue/:id`.
- Otherwise → `POST /ai/analyze-draft` with `{ title, description, labels }`.

---

## 10. TypeScript Types

**File:** `types/index.ts`

```ts
type Role = "admin" | "pm" | "developer" | "viewer"
type Priority = "critical" | "high" | "medium" | "low"
type IssueStatus = "todo" | "in_progress" | "review" | "done"
type IssueType = "task" | "subtask" | "bug"
type SprintStatus = "planned" | "active" | "completed"

interface User {
  id: string
  name: string
  email: string
  role: Role
  avatarUrl: string | null
}

interface Project {
  id: string
  name: string
  description: string
  ownerId: string
  memberIds: string[]
  isArchived: boolean
  createdAt: string
}

interface ProjectMember {
  id: string
  user: User
  joinedAt: string
}

interface Sprint {
  id: string
  name: string
  goal: string
  status: SprintStatus
  startDate: string | null
  endDate: string | null
  project: string
  createdAt: string
}

interface Label {
  id: string
  name: string
  color: string      // hex string
  project: string
}

interface Issue {
  id: string
  title: string
  description: string
  status: IssueStatus
  priority: Priority
  issueType: IssueType
  storyPoints: number | null
  dueDate: string | null
  projectId: string
  sprintId: string | null
  assigneeId: string | null
  reporterId: string
  parentId: string | null
  labels: Label[]
  subtaskCount: number
  doneSubtaskCount: number
  progress: number | null
  createdAt: string
  updatedAt: string
}

interface WikiPage {
  id: string
  title: string
  content: string
  parentId: string | null
  projectId: string
  createdAt: string
  updatedAt: string
}

interface WikiPageVersion {
  id: string
  versionNumber: number
  title: string
  content: string
  createdBy: Pick<User, "id" | "name">
  createdAt: string
}

interface SearchResult {
  id: string
  type: "ticket" | "wiki"
  title: string
  excerpt: string
  projectId: string
}

interface AIAnalysisResult {
  storyPoints: number
  justification: string
  requiredRoles: string[]
  capacityAnalysis: string
  recommendedTeam: Record<string, { id: string; name: string } | null>
}

interface AiPulseResult {
  sprint: Sprint
  stats: {
    total: number
    done: number
    inProgress: number
    todo: number
    storyPointsDone: number
    storyPointsTotal: number
  }
  teamWorkload: { name: string; open: number; highPriority: number }[]
  aiSummary: string
  highlights: { text: string; tag: string }[]
}

interface VelocityData {
  sprintName: string
  committed: number
  completed: number
  completionRate: number
}

interface WorkloadData {
  userId: string
  name: string
  openByStatus: { todo: number; in_progress: number; review: number }
  totalStoryPoints: number
  priorityCounts: { critical: number; high: number; medium: number; low: number }
}
```

---

## 11. Utilities & Constants

### `lib/constants.ts`

```ts
PERMISSIONS = {
  manageProjects: ["admin", "pm"],
  createIssues:   ["admin", "pm", "developer"],
  writeWiki:      ["admin", "pm", "developer"],
  manageUsers:    ["admin"],
  viewAnalytics:  ["admin", "pm", "developer", "viewer"],
}

PRIORITY_COLORS = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  high:     "bg-orange-100 text-orange-800 ...",
  medium:   "bg-yellow-100 text-yellow-800 ...",
  low:      "bg-green-100 text-green-800 ...",
}

STATUS_LABELS = {
  todo:        "To Do",
  in_progress: "In Progress",
  review:      "Review",
  done:        "Done",
}
```

### `lib/utils.ts`

| Function | Signature | Returns |
|---|---|---|
| `formatDate` | `(iso: string) => string` | Locale-formatted date string |
| `getInitials` | `(name: string) => string` | Up to 2 initials from first + last word |
| `truncate` | `(str: string, max: number) => string` | String clamped to `max` chars with `…` |
| `groupBy` | `<T>(arr: T[], key: keyof T) => Record<string, T[]>` | Groups array by field value |

### `mocks/mockData.ts`

Only active when `VITE_USE_MOCK=true`. Exports `mockUsers`, `mockProjects`, `mockIssues`, `mockWikiPages` with realistic seed data. The API module functions check this env flag at the top and return mock data instead of making HTTP requests.
