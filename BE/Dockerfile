# ── Django Backend – Development Image ──────────────────────────────────────
FROM python:3.12-slim

# System deps needed by psycopg2-binary and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the requirements fix script and requirements file
COPY fix_requirements.py .
COPY requirements.txt .

# Fix requirements.txt:
#   - converts UTF-16 → UTF-8  (Windows saves files as UTF-16)
#   - strips --hash=sha256 entries (pip hash-checking breaks in Docker)
RUN python3 fix_requirements.py

RUN pip install --no-cache-dir -r requirements.txt

# Copy source (overridden by volume mount in dev)
COPY . .

WORKDIR /app/jira_main

EXPOSE 8000

# Run migrations then start the dev server
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]
