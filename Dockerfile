# Stage 1 — build the React frontend
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Empty string → relative URLs so nginx can proxy API calls on the same host
ARG VITE_API_HOST=""
ENV VITE_API_HOST=$VITE_API_HOST
RUN npm run build

# Stage 2 — backend + serve frontend via nginx + uvicorn
FROM python:3.12-slim
WORKDIR /app

# System deps — libxcb1/libgl1/libglib2.0-0 required by OpenCV (used by docling)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        nginx supervisor curl \
        libxcb1 libgl1 libglib2.0-0 libsm6 libxext6 libxrender1 && \
    rm -rf /var/lib/apt/lists/*

# Run OpenCV/Qt in headless mode — no display required
ENV QT_QPA_PLATFORM=offscreen

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy backend source
COPY backend/ ./

# Install Python dependencies into /app/.venv
RUN uv sync --frozen --no-dev --python python3.12 && \
    /app/.venv/bin/python -c "import uvicorn" && \
    echo "venv OK"

# Copy built frontend
COPY --from=frontend /app/frontend/dist /app/static

# Config files
COPY docker/nginx.conf /etc/nginx/sites-enabled/default
COPY docker/supervisord.conf /etc/supervisor/conf.d/app.conf
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh && rm -f /etc/nginx/sites-enabled/000-default || true

EXPOSE 80

CMD ["/start.sh"]
