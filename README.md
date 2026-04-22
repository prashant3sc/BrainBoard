# BrainBoard

A Jira-like project management tool built with Django (BE) + React/Vite (FE) + FastAPI AI + PostgreSQL.

---

## 🐳 What is Docker? (The Core Idea)

```
Without Docker:                        With Docker:
─────────────────────────────────      ─────────────────────────────────
Your PC                                Your PC
├── Python installed?      ❓          └── Docker Desktop (installed once)
├── PostgreSQL installed?  ❓                └── Containers run inside here
├── Node.js installed?     ❓                    ├── ✅ Python (isolated)
├── Correct versions?      ❓                    ├── ✅ PostgreSQL (isolated)
└── Env variables set?     ❓                    ├── ✅ Node.js (isolated)
                                                 └── ✅ FastAPI (isolated)
Works on Prashant's PC ✅              Works on EVERYONE's PC ✅
Breaks on teammate's PC ❌             No setup needed ✅
```

> **Docker = A box that contains the app + everything it needs to run.**
> That box behaves identically on every machine.

---

## 📦 3 Core Docker Concepts

### 1. Image → Like a Blueprint / Recipe
```
Dockerfile  ──(build)──▶  Image
(recipe)                  (blueprint — stored, shareable)
```
- A read-only template. e.g. "Python 3.12 + our requirements.txt installed"
- Built once, reused many times

### 2. Container → Like a Running Instance
```
Image  ──(run)──▶  Container
(blueprint)        (the actual running process)
```
- A container is a **live, running box** created from an Image
- You can start, stop, restart it

### 3. Volume → Persistent Storage / Live Folder Sync
```
Your PC Folder  ◀──(sync)──▶  Container Folder
./BE/                          /app/
```
- Solves two problems:
  - **Data persistence** → DB data survives container restarts
  - **Live reload** → You edit code on your PC, container sees changes instantly

---

## 🏗️ BrainBoard Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              Docker Desktop                              │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ brainboard   │  │ brainboard   │  │ brainboard   │  │ brainboard  │  │
│  │    _db       │  │   _pgadmin   │  │    _be       │  │    _ai      │  │
│  │              │  │              │  │              │  │             │  │
│  │  PostgreSQL  │  │   pgAdmin    │◀─│  Django      │  │  FastAPI    │  │
│  │  port 5432   │  │  port 5050   │  │  port 8000   │  │  port 8001  │  │
│  └──────┬───────┘  └──────────────┘  └──────┬───────┘  └─────────────┘  │
│         │                                    │                           │
│         └────────────────────────────────────┘                           │
│                          SQL queries                                     │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                     brainboard_fe (React/Vite)                    │   │
│  │                          port 5173                                │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

### How the services talk to each other

```
Browser (Chrome) → http://localhost:5173
        │
        ▼
  brainboard_fe (React/Vite)
        │  API calls → http://localhost:8000
        ▼
  brainboard_be (Django)      ←──→  brainboard_ai (FastAPI :8001)
        │  SQL (host = "db")
        ▼
  brainboard_db (PostgreSQL)
```

---

## 📁 File Structure

```
BrainBoard/
│
├── docker-compose.yml         ← 🎛️  DB HOST (Prashant) — all 5 services
├── docker-compose.client.yml  ← 🎛️  TEAMMATES — BE + AI + FE only
│
├── .env                       ← 🔑  SECRET CONFIG (never commit to git!)
│                                    DB password, secret keys, API keys
│                                    Get this file from Prashant
│
├── .env.client.example        ← 📋  TEAMMATE TEMPLATE
│                                    Copy → .env, set DB_HOST to Prashant's IP
│
├── BE/
│   ├── Dockerfile             ← 📦  Python 3.12-slim + Django
│   ├── fix_requirements.py   ← 🔧  Strips UTF-16 encoding & pip hashes
│   │                                before pip install (Windows fix)
│   └── jira_main/
│       └── jira_main/
│           └── settings.py    ← ⚙️  Reads all config from .env
│                                    (DB_HOST, DB_PASSWORD, SECRET_KEY…)
│
├── AI/
│   ├── Dockerfile.dev         ← 📦  Python 3.10-slim + FastAPI + uvicorn
│   └── app/
│       └── main.py            ← ⚙️  FastAPI entrypoint
│
└── FE/
    └── Dockerfile             ← 📦  Node 20-alpine + Vite dev server
```

---

## ⚡ Startup Sequence (What happens on `docker-compose up`)

```
docker-compose up --build
        │
        ├─ Step 1: Build Images (only on first run or when Dockerfile changes)
        │          BE/Dockerfile     ──▶  brainboard_be image
        │          AI/Dockerfile.dev ──▶  brainboard_ai image
        │          FE/Dockerfile     ──▶  brainboard_fe image
        │          postgres:16-alpine ──▶  pulled from Docker Hub (auto)
        │          dpage/pgadmin4   ──▶  pulled from Docker Hub (auto)
        │
        ├─ Step 2: Start DB container first
        │          brainboard_db starts
        │          PostgreSQL boots up…
        │          Healthcheck: "is pg_isready?" → polls every 5s, up to 10x
        │
        ├─ Step 3: Start pgAdmin + BE (only after DB is healthy ✅)
        │          pgAdmin → http://localhost:5050
        │          Django  → runs migrate, then runserver 0.0.0.0:8000
        │
        ├─ Step 4: Start AI service (no DB dependency)
        │          FastAPI → uvicorn with --reload on port 8001
        │
        └─ Step 5: Start FE (after BE starts)
                   Vite dev server → http://localhost:5173 ✅
```

---

## 🚀 Running the Project

### Prerequisites
- Install **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** — one time only
- Get the `.env` file from Prashant

### Who is the DB Host?
One person on the team (Prashant) runs the PostgreSQL container.
Everyone else connects to it over the network.

```
Prashant's PC                           Teammate's PC
──────────────────────────────          ──────────────────────────────────────
docker-compose up                       docker-compose -f docker-compose.client.yml up
│                                       │
├── db        (PostgreSQL :5432) ◀──────┤ DB_HOST = Prashant's LAN IP
├── pgadmin   (pgAdmin    :5050)        ├── be  (Django  :8000) → Prashant's DB
├── be        (Django     :8000)        ├── ai  (FastAPI :8001)
├── ai        (FastAPI    :8001)        └── fe  (React   :5173)
└── fe        (React      :5173)
```

---

### For Prashant (DB Host)

```bash
# 1. Start everything (first time — builds images + starts all 5 services)
docker-compose up --build

# 2. First time only — seed the database with test users & sample data
docker-compose exec be python manage.py seed_data

# 3. Find your LAN IP and share it with teammates
ipconfig        # Windows → look for "IPv4 Address" e.g. 192.168.1.10
```

**Your services:**

| Service    | URL                       |
|------------|---------------------------|
| Frontend   | http://localhost:5173      |
| Backend API| http://localhost:8000      |
| AI Service | http://localhost:8001      |
| pgAdmin    | http://localhost:5050      |
| PostgreSQL | localhost:5432             |

---

### For Teammates

```bash
# 1. Get .env.client.example from Prashant, copy it to .env
# 2. Open .env and set DB_HOST to Prashant's LAN IP
#    e.g. DB_HOST=192.168.1.10

# 3. Start BE + AI + FE only (no DB — using Prashant's)
docker-compose -f docker-compose.client.yml up --build
```

> Both machines must be on the **same network** (same office WiFi / LAN).

**Your services:**

| Service    | URL                       |
|------------|---------------------------|
| Frontend   | http://localhost:5173      |
| Backend API| http://localhost:8000      |
| AI Service | http://localhost:8001      |

---

## 🗄️ Browsing the Database (pgAdmin)

pgAdmin lets you inspect all database tables from your browser — no SQL client needed.

1. Open **http://localhost:5050** (only available on Prashant's machine)
2. Login with the credentials from your `.env`:
   - Email: `PGADMIN_EMAIL` (default: `admin@brainboard.com`)
   - Password: `PGADMIN_PASSWORD` (default: `admin123`)
3. **Add a new server:**
   - Right-click **Servers** → **Register** → **Server**
   - **General** tab → Name: `BrainBoard`
   - **Connection** tab:
     - Host: `db`
     - Port: `5432`
     - Username: value of `DB_USER` in your `.env`
     - Password: value of `DB_PASSWORD` in your `.env`
4. Click **Save** — you can now browse all tables under `Databases → jira_main → Schemas → public → Tables`

---

## 🔑 Test Accounts (after seed)

All passwords: `Test1234!`

| Email                    | Role            |
|--------------------------|-----------------|
| admin@brainboard.com     | Admin           |
| pm1@brainboard.com       | Project Manager |
| dev1@brainboard.com      | Developer       |
| viewer@brainboard.com    | Viewer          |

---

## 🗺️ Navigation Flow

```
Login → Dashboard
    └── Click a project card
            └── Backlog page     ← Create & start sprints here
                    └── Start a sprint
                            └── Board page   ← Kanban with drag & drop
```

> **Note:** If there is no active sprint, the Board page shows an empty state.
> Go to **Backlog** first to create and start a sprint.

---

## 🛠️ Common Commands

```bash
# ── Starting ─────────────────────────────────────────────────────────
# Start all services (with image rebuild)
docker-compose up --build

# Start all services (no rebuild — faster for daily use)
docker-compose up

# Teammates only
docker-compose -f docker-compose.client.yml up --build

# ── Stopping ─────────────────────────────────────────────────────────
# Stop containers (keeps DB data safe)
docker-compose down

# Stop + wipe ALL DB data (fresh start)
docker-compose down -v

# ── Database ──────────────────────────────────────────────────────────
# Seed initial test data
docker-compose exec be python manage.py seed_data

# Clear existing data and re-seed
docker-compose exec be python manage.py seed_data --clear

# Run any Django management command
docker-compose exec be python manage.py <command>

# ── Logs & Debugging ─────────────────────────────────────────────────
# View live logs from all services
docker-compose logs -f

# View logs for a single service
docker-compose logs -f be
docker-compose logs -f fe
docker-compose logs -f ai

# ── Fixing a frozen/crashing frontend ────────────────────────────────
# If the React page keeps reloading after a code error, restart the container
docker-compose restart fe
# Then do a hard refresh in browser: Ctrl + Shift + R
```

---

## ❓ Common Questions

**Q: Do we all share the same database?**
> Yes. The DB runs only on Prashant's machine. Teammates connect to it over the network via `DB_HOST=<Prashant's IP>`. Everyone reads and writes the same data.

**Q: Where is the DB data stored? Does it delete on restart?**
> Stored in the `postgres_data` Docker named volume on Prashant's machine. `docker-compose down` keeps it safe. Only `docker-compose down -v` deletes it.

**Q: I edited a file — do I need to rebuild?**
> **No** for code changes — volume mounts sync your edits into the container instantly (hot reload).
> **Yes** only if you change `requirements.txt` or `package.json`:
> ```bash
> docker-compose up --build
> ```

**Q: How does Django find the DB? The host isn't `localhost`!**
> Inside Docker, containers talk to each other by **service name**. Django uses `DB_HOST=db` (the service name in `docker-compose.yml`). Teammates use `DB_HOST=<Prashant's IP>` to reach it over the network. Your `.env` already has this set correctly.

**Q: Why is there a `fix_requirements.py` in the BE folder?**
> Windows sometimes saves `requirements.txt` as UTF-16 encoded (with a BOM), and pip hashes (`--hash=sha256:...`) are included when you export with `pip freeze`. Both of these break `pip install` inside Docker (which runs Linux). `fix_requirements.py` runs automatically during the Docker build and converts the file to plain UTF-8 with hashes stripped — no manual action needed.

**Q: The frontend page is stuck in an infinite reload loop — what do I do?**
> Vite's hot-module reload (HMR) cannot recover from a crashed React tree. Fix it with:
> ```bash
> docker-compose restart fe
> ```
> Then do a hard refresh in your browser: `Ctrl + Shift + R`.

**Q: What if we work remotely (different networks)?**
> Set up **[Tailscale](https://tailscale.com/)** — it's free for up to 100 devices and creates a secure private network between all your machines. Prashant gets a stable Tailscale IP (like `100.x.x.x`) that teammates use as `DB_HOST`.

**Q: What ports does each service use?**
> | Service    | Port  |
> |------------|-------|
> | Frontend   | 5173  |
> | Django BE  | 8000  |
> | FastAPI AI | 8001  |
> | pgAdmin    | 5050  |
> | PostgreSQL | 5432  |
