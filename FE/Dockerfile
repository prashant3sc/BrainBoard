# ── React / Vite Frontend – Development Image ────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm install

# Copy source (overridden by volume mount in dev)
COPY . .

EXPOSE 5173

# --host exposes Vite outside the container so the browser can reach it
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
