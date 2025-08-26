Serving frontend from the Flask backend (single-process)
=====================================================

This simple setup lets the Flask backend serve the built frontend SPA so you can run a single process in development or testing without Docker.

Steps:

1. Build the frontend:

   cd frontend
   npm install
   npm run build

   This will produce a `dist/` folder inside `frontend/`.

2. Install backend requirements (prefer a virtualenv):

   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt

3. Run the backend (serves API under /api/* and static SPA on /):

   export FLASK_ENV=development
   python3 backend/app.py

Notes:
- In production you should use a production-ready WSGI server and a real database, plus configure ALLOWED_ORIGINS, JWT_SECRET, and other secrets.
- This README describes a simple single-host dev mode (option B requested).

Quick publish / share options
---------------------------

1) Local test with seeded users (recommended for quick multi-user testing)

   ./backend/serve_and_seed.sh

   This will build the frontend, start the backend in development mode, seed two demo users (alice/bob) and print JWT tokens you can paste into `localStorage.token` in the browser devtools.

2) Share locally with ngrok

   After starting the backend as above, run:

     ngrok http 5001

   Then share the forwarded URL with others. Note: update ALLOWED_ORIGINS or run with FLASK_ENV=development to allow cross-origin requests during testing.

3) Deploy to a simple PaaS (Render / Railway / Fly)

   - Build the frontend in CI (npm ci && npm run build) and copy `frontend/dist` into the server image or artifact.
   - Install `backend/requirements.txt` and run `python3 backend/app.py` (or use gunicorn + eventlet for production).

   Render.com
   ----------

   This repo includes a `render.yaml` that defines both a Python web service (`backend`) and a static site (`frontend`). The backend start command in `render.yaml` uses `gunicorn -k eventlet` so Flask-SocketIO supports WebSocket transports.

   When deploying to Render:

      - Add any production secrets via the Render dashboard (JWT_SECRET, DB URL, etc.).
      - The `ALLOWED_ORIGINS` env var in `render.yaml` is wired from the frontend service host so CORS will allow the SPA when both services are deployed together.


