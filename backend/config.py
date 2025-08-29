import os

# Environment configuration helpers
APP_ENV = os.environ.get("APP_ENV", os.environ.get("FLASK_ENV", "production")).lower()
DATABASE_URL = os.environ.get('DATABASE_URL') or 'sqlite:///./data.db'
REDIS_URL = os.environ.get('REDIS_URL') or os.environ.get('REDIS_URI')
JWT_SECRET = os.environ.get('JWT_SECRET', 'devsecret')
ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '')


def determine_origins(app_env, allowed_origins_env):
    """Normalize ALLOWED_ORIGINS into a value suitable for flask-cors.
    Returns either '*' or a list of origins.
    """
    raw = [o.strip() for o in (allowed_origins_env or '').split(',') if o.strip()]
    if len(raw) == 1 and raw[0] == '*':
        return '*'
    origins = []
    for o in raw:
        if '://' in o:
            origins.append(o)
        else:
            origins.append(f"https://{o}")
            origins.append(f"http://{o}")
    # In development allow the Vite dev server if nothing explicit set
    if app_env == 'development' and not origins:
        origins = ["http://localhost:5173"]
    return origins
