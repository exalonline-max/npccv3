#!/usr/bin/env bash
set -euo pipefail

# Build frontend and run backend in development with seeded demo data
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"
echo "Installing frontend deps and building..."
npm install
npm run build

cd "$ROOT"
echo "Starting backend (development mode) with seeded data..."
export FLASK_ENV=development
python3 backend/app.py
