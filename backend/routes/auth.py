from flask import Blueprint, jsonify, request
from ..services.auth import make_token, get_user_from_auth
from ..services.campaigns import db_create_campaign
from ..db import SessionLocal
from ..models import User
from ..config import APP_ENV
from werkzeug.security import generate_password_hash, check_password_hash

bp = Blueprint('auth', __name__)

# In-memory mirrors for development
USERS = []
NEXT_USER_ID = 1


@bp.route('/api/auth/register', methods=['POST'])
def register():
    global NEXT_USER_ID
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    username = data.get('username')
    if not email or not password or not username:
        return jsonify({"message": "email, username and password are required"}), 400
    try:
        existing = None
        try:
            s = SessionLocal()
            existing = s.query(User).filter(User.email == email).first()
            s.close()
        except Exception:
            existing = None
    except Exception:
        existing = None
    if existing:
        return jsonify({"message": "email already exists"}), 400
    start_time = __import__('time').time()
    pwd_hash = generate_password_hash(password)
    try:
        new_user = None
        try:
            s = SessionLocal()
            import uuid as _uuid
            u = User(email=email, username=username, password_hash=pwd_hash, uuid=str(_uuid.uuid4()))
            s.add(u)
            s.commit()
            s.refresh(u)
            new_user = u
            s.close()
        except Exception:
            raise
        mirror = {'id': new_user.id, 'email': new_user.email, 'username': new_user.username, 'password_hash': new_user.password_hash}
        if APP_ENV == 'development':
            USERS.append(mirror)
        token = make_token(mirror)
        return jsonify({"token": token, "user": mirror}), 201
    except Exception:
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        if any(u['email'] == email for u in USERS):
            return jsonify({"message": "email already exists"}), 400
        user = {
            'id': NEXT_USER_ID,
            'email': email,
            'username': username,
            'password_hash': generate_password_hash(password)
        }
        NEXT_USER_ID += 1
        USERS.append(user)
        token = make_token(user)
        return jsonify({"token": token, "user": user}), 201


@bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({'message': 'email and password are required'}), 400
    db_error = False
    dbu = None
    try:
        s = SessionLocal()
        dbu = s.query(User).filter(User.email == email).first()
        s.close()
    except Exception:
        dbu = None
        db_error = True
    if dbu:
        try:
            if not check_password_hash(str(dbu.password_hash), password):
                return jsonify({'message': 'invalid credentials'}), 401
        except Exception:
            return jsonify({'message': 'invalid credentials'}), 401
        user = {'id': dbu.id, 'email': dbu.email, 'username': dbu.username}
        token = make_token(user)
        return jsonify({'token': token, 'user': user}), 200
    if db_error and APP_ENV != 'development':
        return jsonify({'message': 'database unavailable'}), 503
    user = next((u for u in USERS if u['email'] == email), None)
    if not user:
        return jsonify({'message': 'invalid credentials'}), 401
    try:
        if not check_password_hash(user.get('password_hash', ''), password):
            return jsonify({'message': 'invalid credentials'}), 401
    except Exception:
        return jsonify({'message': 'invalid credentials'}), 401
    token = make_token(user)
    safe_user = {'id': user.get('id'), 'email': user.get('email'), 'username': user.get('username')}
    return jsonify({'token': token, 'user': safe_user}), 200


# Development-only helper routes removed for MVP. Use database and scripts/tools
# for user provisioning and cleanup. The in-memory fallback remains for tests
# when APP_ENV == 'development' but no public/_dev endpoints are exposed.
