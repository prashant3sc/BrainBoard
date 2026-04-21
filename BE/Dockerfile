# ── Django Backend – Development Image ──────────────────────────────────────
FROM python:3.11-slim

# System deps needed by psycopg2-binary and other packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source (overridden by volume mount in dev)
COPY . .

WORKDIR /app/jira_main

EXPOSE 8000

# Run migrations then start the dev server
CMD ["sh", "-c", "python manage.py migrate --noinput && python manage.py runserver 0.0.0.0:8000"]
