#!/bin/sh
set -e

echo "Running database migrations..."
cd /app && /app/.venv/bin/python -m alembic upgrade head

echo "Starting services..."
exec /usr/bin/supervisord -n -c /etc/supervisor/supervisord.conf
