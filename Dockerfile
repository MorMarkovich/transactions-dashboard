# ── Stage 1: Build the React frontend ────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

# Install dependencies first (cached layer)
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Supabase keys are injected at build time by Render env vars
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ── Stage 2: Python / FastAPI backend ────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/app/ ./app/

# Copy the compiled React app
COPY --from=frontend-builder /app/frontend/dist ./static

# Uploads directory (ephemeral – files are deleted after processing anyway)
RUN mkdir -p uploads

EXPOSE 8000
# Render sets PORT env var; fall back to 8000 for local Docker runs
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
