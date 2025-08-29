#!/usr/bin/env bash
set -euo pipefail
# deploy/alembic_upgrade.sh
# Run Alembic migrations against DATABASE_URL in the environment.
# Intended for use in deploy pipelines or as a one-off.

echo "[deploy] Running alembic upgrade head"
if ! command -v alembic >/dev/null 2>&1; then
  echo "alembic not found in PATH; installing requirements from backend/requirements.txt"
  pip install -r backend/requirements.txt
fi
# Ensure we run alembic from the repository root and use the backend alembic.ini
cwd=$(pwd)
cd "$(dirname "$0")/.."
# Use backend/alembic.ini explicitly
if [ ! -f backend/alembic.ini ]; then
  echo "backend/alembic.ini not found"
  exit 1
fi
# Run Alembic upgrade; allow failures to not block start (script caller may choose to fail)
set +e
alembic -c backend/alembic.ini upgrade head
status=$?
set -e
if [ $status -ne 0 ]; then
  echo "[deploy] alembic upgrade returned status $status"
  cd "$cwd"
  exit $status
fi
cd "$cwd"
echo "[deploy] alembic upgrade completed"
