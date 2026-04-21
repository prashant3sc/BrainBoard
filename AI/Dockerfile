# ===== Stage 1: Builder =====
FROM python:3.10-slim AS builder

WORKDIR /build

# Install dependencies into an isolated location
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ===== Stage 2: Production Image =====
FROM python:3.10-slim AS production

WORKDIR /app

# Copy installed packages from builder stage (keeps the image lean)
COPY --from=builder /install /usr/local

# Copy only the application source code
COPY app/ ./app/

# Expose the API port
EXPOSE 8000

# Run with uvicorn standard (includes uvloop for better async performance)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
