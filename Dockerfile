# Multi-stage build: Node builds the Vite frontend, Python runs FastAPI + serves it.

# ---------- Stage 1: build frontend ----------
FROM node:22-alpine AS frontend-builder
WORKDIR /app

# Install deps (use ci for reproducible builds when lockfile present)
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# Copy sources needed for build. vite.config.js sets publicDir: 'models',
# so models/* is flattened into dist/ at build time.
COPY index.html ./
COPY vite.config.js ./
COPY src ./src
COPY models ./models

RUN npm run build


# ---------- Stage 2: runtime ----------
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /app

# Slim runtime deps only (no jupyter/numpy/pandas/matplotlib).
COPY requirements-runtime.txt ./
RUN pip install -r requirements-runtime.txt

# Backend source
COPY backend ./backend

# Built static assets (HTML, JS, CSS, GLB models, animations)
COPY --from=frontend-builder /app/dist ./dist

EXPOSE 8000

# Single worker is enough for SSE pass-through; uvicorn handles concurrency via asyncio.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips=*"]
