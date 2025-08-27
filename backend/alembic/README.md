Alembic migrations for NPC Chatter backend.

Usage (from repository root):

1. Create a virtualenv and install deps:

    python3 -m venv .venv
    source .venv/bin/activate
    pip install -r backend/requirements.txt
    pip install alembic

2. Generate an autogenerate revision:

    cd backend
    alembic revision --autogenerate -m "initial schema"

3. Apply migrations:

    alembic upgrade head
