#!/usr/bin/env bash
# Safe runner for production Alembic migrations.
# Usage: set DATABASE_URL in env and run this script from repo root: ./backend/scripts/run_migrations_prod.sh
# It assumes a virtualenv with requirements installed or a Python environment where alembic is available.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Please set DATABASE_URL environment variable (postgres://user:pass@host:port/dbname)"
  exit 1
fi
# Activate venv if present
if [ -f ".venv/bin/activate" ]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
fi
export DATABASE_URL
echo "Running alembic upgrade head against $DATABASE_URL"
# Ensure alembic is available
if ! command -v alembic >/dev/null 2>&1; then
  echo "alembic not found, installing into current env..."
  pip install alembic
fi
alembic -c alembic.ini upgrade head
echo "Migration finished."
