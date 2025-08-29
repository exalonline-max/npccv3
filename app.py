"""Top-level WSGI entrypoint for Render / Gunicorn.

This module imports the package-level create_app and exposes `app` so
gunicorn can load `app:app` without relative-import errors.

It also initializes DB and SocketIO when imported by the process.
"""
import os
from backend import create_app
from backend.config import APP_ENV, REDIS_URL, JWT_SECRET, DATABASE_URL
from backend.db import init_db
from backend.extensions import socketio

# static folder lives next to the repo frontend/dist
STATIC_FOLDER = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')


def _create():
    app = create_app(static_folder=STATIC_FOLDER)
    # Safe startup debug: print only presence of env vars
    print(f"startup env presence: APP_ENV={APP_ENV}, DATABASE_URL_set={bool(DATABASE_URL)}, REDIS_url_set={bool(REDIS_URL)}, JWT_SECRET_set={bool(JWT_SECRET)}")
    # Initialize DB if available
    try:
        init_db()
    except Exception:
        pass
    # Init socketio with message queue if present
    if REDIS_URL:
        socketio.init_app(app, cors_allowed_origins="*", message_queue=REDIS_URL)
    else:
        socketio.init_app(app, cors_allowed_origins="*")
    return app


app = _create()


if __name__ == '__main__':
    # run directly for local debugging
    socketio.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
