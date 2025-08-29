import jwt
from flask import request
from ..db import SessionLocal
from ..config import JWT_SECRET, APP_ENV
from ..models import User


def make_token(user):
    uid = None
    email = None
    username = None
    try:
        if isinstance(user, dict):
            uid = user.get('id')
            email = user.get('email')
            username = user.get('username')
        else:
            uid = getattr(user, 'id', None)
            email = getattr(user, 'email', None)
            username = getattr(user, 'username', None)
    except Exception:
        pass
    # Ensure subject is a string to avoid PyJWT validation errors in newer versions
    payload = {'sub': str(uid) if uid is not None else None}
    if email is not None:
        try:
            payload['email'] = email
        except Exception:
            pass
    if username is not None:
        try:
            payload['username'] = username
        except Exception:
            pass
    token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
    return token


def get_user_from_auth(req=None, in_memory_users=None):
    """Extract token from Authorization header / query / cookie and return a lightweight user dict.
    in_memory_users is a list used only in development for fallback.
    """
    if req is None:
        req = request
    token = None
    try:
        auth_header = req.headers.get('Authorization') or req.environ.get('HTTP_AUTHORIZATION')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
        elif auth_header:
            token = auth_header
    except Exception:
        token = None
    if not token:
        try:
            token = req.args.get('token')
        except Exception:
            pass
    if not token:
        try:
            cookie_tok = req.cookies.get('token')
            if cookie_tok:
                token = cookie_tok
        except Exception:
            pass
    if not token:
        return None
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        uid = data.get('sub')
        try:
            if isinstance(uid, str) and uid.isdigit():
                uid = int(uid)
        except Exception:
            pass
        db_error = False
        try:
            s = SessionLocal()
            dbu = s.query(User).filter(User.id == uid).first()
            s.close()
            if dbu:
                return {'id': dbu.id, 'email': dbu.email, 'username': dbu.username}
        except Exception:
            db_error = True
        if APP_ENV == 'development' or not db_error:
            if in_memory_users:
                return next((u for u in in_memory_users if u.get('id') == uid), None)
        return None
    except Exception:
        return None
