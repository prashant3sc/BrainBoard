# BrainBoard Backend — Local Setup

Step-by-step instructions to get the backend running on your machine.

---

## Prerequisites

Make sure the following are installed before you begin:

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11+ | Check with `python --version` |
| PostgreSQL | 14+ | Must be running locally |
| pip | Latest | Comes with Python |
| Git | Any | To clone the repo |

---

## 1. Clone the Repository

```bash
git clone <repository-url>
cd BrainBoard/BE
```

---

## 2. Create a Virtual Environment

```bash
python -m venv hack_env
```

**Activate it:**

- **Windows (PowerShell):**
  ```powershell
  hack_env\Scripts\Activate.ps1
  ```
- **Windows (CMD):**
  ```cmd
  hack_env\Scripts\activate.bat
  ```
- **macOS / Linux:**
  ```bash
  source hack_env/bin/activate
  ```

You should see `(hack_env)` in your terminal prompt.

---

## 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 4. Set Up PostgreSQL Database

Open the PostgreSQL shell (psql) or any PostgreSQL client and run:

```sql
CREATE DATABASE jira_main;
```

The Django settings expect the following credentials:

| Setting | Value |
|---|---|
| Host | localhost |
| Port | 5432 |
| Database | jira_main |
| User | postgres |
| Password | 1234 |

If your PostgreSQL setup uses a different user or password, update `jira_main/settings.py`:

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "jira_main",
        "USER": "your_postgres_user",      # change here
        "PASSWORD": "your_password",        # change here
        "HOST": "localhost",
        "PORT": "5432",
    }
}
```

---

## 5. Run Migrations

Navigate into the Django project directory and apply all migrations:

```bash
cd jira_main
python manage.py migrate
```

This creates all tables for `users`, `projects`, `issues`, `wiki`, and `search` apps.

---

## 6. Create a Superuser (Optional)

To access the Django Admin panel at `/admin/`, create a superuser:

```bash
python manage.py createsuperuser
```

You will be prompted for an email, first name, last name, and password.

---

## 7. Seed the Database with Test Data (Recommended)

Populate the database with realistic test users, projects, sprints, issues, and wiki pages:

```bash
python manage.py seed_data
```

To wipe everything and start fresh:

```bash
python manage.py seed_data --clear
```

**Test accounts created (all password: `Test1234!`):**

| Email | Role |
|---|---|
| admin@brainboard.com | admin |
| pm1@brainboard.com | pm |
| pm2@brainboard.com | pm |
| dev1@brainboard.com | developer |
| dev2@brainboard.com | developer |
| dev3@brainboard.com | developer |
| viewer@brainboard.com | viewer |

---

## 8. Start the Development Server

```bash
python manage.py runserver
```

The API will be available at: **http://localhost:8000**

To run on a different port:

```bash
python manage.py runserver 8080
```

---

## 9. Verify the Setup

Test that everything is working by logging in:

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@brainboard.com", "password": "Test1234!"}'
```

A successful response returns a JWT token and the user object:

```json
{
  "token": "<jwt-access-token>",
  "user": {
    "id": "...",
    "name": "...",
    "email": "admin@brainboard.com",
    "role": "admin"
  }
}
```

Use that token in subsequent requests:

```bash
curl http://localhost:8000/projects \
  -H "Authorization: Bearer <jwt-access-token>"
```

---

## 10. Access the Admin Panel

Open **http://localhost:8000/admin/** in your browser and log in with the superuser you created in step 6.

If you used the seed command, you can also log in at the admin with `admin@brainboard.com` / `Test1234!` (as long as that user was also made a Django superuser via `createsuperuser`, or you manually promote them in the admin).

---

## Project Structure Reference

```
BE/
├── hack_env/                    # Virtual environment (not committed)
├── jira_main/                   # Django project root
│   ├── manage.py
│   ├── jira_main/               # Project config package
│   │   ├── settings.py          # All Django/JWT/DB settings
│   │   ├── urls.py              # Root URL routing
│   │   ├── wsgi.py
│   │   └── asgi.py
│   ├── users/                   # Auth, user model, RBAC
│   ├── projects/                # Projects, members, sprints
│   ├── issues/                  # Issues, labels
│   ├── wiki/                    # Wiki pages, versions, links
│   └── search/                  # Global search
└── requirements.txt
```

---

## Common Issues

### `psycopg2` import error

Make sure PostgreSQL is installed and the `psycopg2-binary` package installed correctly:

```bash
pip install psycopg2-binary
```

On some systems you may need the `libpq-dev` system package:

```bash
# Ubuntu/Debian
sudo apt-get install libpq-dev

# macOS
brew install libpq
```

### `django.db.utils.OperationalError: could not connect to server`

- Confirm PostgreSQL is running: `pg_ctl status` or check your system services.
- Confirm the database `jira_main` exists.
- Confirm the credentials in `settings.py` match your PostgreSQL setup.

### `ModuleNotFoundError` after activating the virtual environment

Make sure you activated the virtual environment **before** installing dependencies and before running Django commands.

### Port already in use

```bash
python manage.py runserver 8001
```

Or find and kill the process using port 8000.

---

## Environment Summary

| Setting | Default Value |
|---|---|
| Django secret key | Set in `settings.py` (change for production) |
| Database | PostgreSQL, `localhost:5432/jira_main` |
| DB user / password | `postgres` / `1234` |
| JWT access lifetime | 8 hours |
| JWT refresh lifetime | 7 days |
| CORS | All origins allowed (development mode) |
| Debug | `True` (development only) |

---

For a full description of models, endpoints, and business logic, see [README.md](README.md).
