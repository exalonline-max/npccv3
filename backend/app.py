from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, join_room, leave_room, emit
import os
import datetime
import jwt
import redis  # Added import for Redis support
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import create_engine, Column, Integer, String, Text, ForeignKey
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy.exc import OperationalError
import json
import time

# Serve static frontend if built into ../frontend/dist
STATIC_FOLDER = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist')
app = Flask(__name__, static_folder=STATIC_FOLDER, static_url_path='')
REDIS_URL = os.environ.get('REDIS_URL') or os.environ.get('REDIS_URI')
if REDIS_URL:
    # when REDIS_URL is present, use it as the message_queue so multiple gunicorn
    # workers or instances can share Socket.IO events. Do NOT hardcode credentials
    # in source; provide them via environment variables (Render config or shell).
    try:
        socketio = SocketIO(app, cors_allowed_origins="*", message_queue=REDIS_URL)
        # Safe log (no secrets): show host portion only for debugging
        try:
            host = REDIS_URL.split('@')[-1].split(':')[0]
            print(f"Using Redis message queue at host: {host}")
        except Exception:
            print("Using Redis message queue")
    except Exception:
        # fallback to in-process socketio if message_queue init fails
        socketio = SocketIO(app, cors_allowed_origins="*")
else:
    socketio = SocketIO(app, cors_allowed_origins="*")

# ----- Environment-aware CORS (safe for prod) -----
# APP_ENV: "development" or "production" (default: "production")
APP_ENV = os.environ.get("APP_ENV", os.environ.get("FLASK_ENV", "production")).lower()

# In production, set ALLOWED_ORIGINS to a comma-separated list of origins, e.g.
# ALLOWED_ORIGINS="https://npcchatter.com,https://www.npcchatter.com"
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "")

if APP_ENV == "development":
    # Only allow Vite dev server in local dev
    CORS(
        app,
        resources={r"/api/*": {"origins": ["http://localhost:5173"]}},
        supports_credentials=False,  # you're returning JWT in JSON, not cookies
        expose_headers=["Content-Type"]
    )
elif ALLOWED_ORIGINS:
    # Restrict production to configured origins.
    # Render's `fromService.property: host` may supply a bare hostname like
    # "www.npcchatter.com" (no scheme). Browsers send an Origin header that
    # includes the scheme (https://...), so normalize entries here. Accept
    # a single asterisk '*' to mean allow all origins (use carefully).
    raw = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]
    if len(raw) == 1 and raw[0] == '*':
        origins = "*"
    else:
        origins = []
        for o in raw:
            if '://' in o:
                origins.append(o)
            else:
                # add both https and http variants so hostname-only values
                # (from some platform envs) match incoming Origin headers.
                origins.append(f"https://{o}")
                origins.append(f"http://{o}")
    CORS(
        app,
        resources={r"/api/*": {"origins": origins}},
        supports_credentials=False,
        expose_headers=["Content-Type"]
    )
# If no ALLOWED_ORIGINS set in prod, CORS is effectively off (same-origin only).

# Safe startup debug: print only whether important env vars are present (no secrets)
print(
    f"startup env presence: APP_ENV={APP_ENV}, "
    f"DATABASE_URL_set={bool(os.environ.get('DATABASE_URL'))}, "
    f"REDIS_url_set={bool(os.environ.get('REDIS_URL') or os.environ.get('REDIS_URI'))}, "
    f"JWT_SECRET_set={bool(os.environ.get('JWT_SECRET'))}"
)

# ----- In-memory stores (demo only) -----
NPCS = []
NEXT_ID = 1
# Lightweight in-memory mirrors used for demo/testing when DB is not used
USERS = []
CAMPAIGNS = []
MEMBERSHIPS = []
CHARACTERS = []
MESSAGES = []

NEXT_USER_ID = 1
NEXT_CAMPAIGN_ID = 1
NEXT_CHARACTER_ID = 1
NEXT_MESSAGE_ID = 1

# Minimal JWT secret for local development; in production provide via env var
JWT_SECRET = os.environ.get('JWT_SECRET', 'devsecret')


def make_token(user):
    # create a JWT that includes at least the subject, and when available
    # include email and username claims so clients can display user info
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
    payload = {'sub': uid}
    if email is not None:
        try: payload['email'] = email
        except Exception: pass
    if username is not None:
        try: payload['username'] = username
        except Exception: pass
    try:
        token = jwt.encode(payload, JWT_SECRET, algorithm='HS256')
        # PyJWT v2 returns a str, older versions may return bytes
        return token
    except Exception:
        # fallback: attempt to return whatever jwt.encode returns
        return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def get_user_from_auth():
    # Extract Bearer token and return a lightweight user dict (from DB if possible)
    token = None
    token_source = 'header'
    try:
        auth_header = request.headers.get('Authorization') or request.environ.get('HTTP_AUTHORIZATION')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
        elif auth_header:
            token = auth_header
    except Exception:
        token = None
    if not token:
        try:
            token = request.args.get('token')
            if token:
                token_source = 'query'
        except Exception:
            pass
    if not token:
        try:
            cookie_tok = request.cookies.get('token')
            if cookie_tok:
                token = cookie_tok
                token_source = 'cookie'
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
        # Try DB lookup first; if DB errors and we're in development allow
        # falling back to the in-memory mirror so local dev still works.
        db_error = False
        try:
            dbu = db_get_user_by_id(uid)
            if dbu:
                return {'id': dbu.id, 'email': dbu.email, 'username': dbu.username}
        except Exception:
            db_error = True
        if APP_ENV == 'development' or not db_error:
            # In development prefer the DB but accept the in-memory mirror.
            return next((u for u in USERS if u['id'] == uid), None)
        # In production, if the DB errored, don't silently return an in-memory
        # user — treat the auth as unavailable.
        return None
    except Exception:
        return None


def db_create_membership(campaign_id, user_id, role='player'):
    s = SessionLocal()
    try:
        import uuid as _uuid
        m = Membership(campaign_id=campaign_id, user_id=user_id, role=role, uuid=str(_uuid.uuid4()))
        s.add(m)
        s.commit()
        s.refresh(m)
        # mirror into in-memory list for demo compatibility
        try:
            MEMBERSHIPS.append({'campaign_id': m.campaign_id, 'user_id': m.user_id, 'role': m.role})
        except Exception:
            pass
        return m
    finally:
        s.close()


def db_create_message(campaign_id, author, text):
    s = SessionLocal()
    try:
        import uuid as _uuid
        ts = datetime.datetime.utcnow().isoformat()
        m = Message(campaign_id=campaign_id, author=author, text=text, timestamp=ts)
        # attach a runtime-only uuid attribute for compatibility
        try:
            m.uuid = str(_uuid.uuid4())
        except Exception:
            pass
        s.add(m)
        s.commit()
        s.refresh(m)
        # mirror into in-memory list for demo compatibility
        try:
            MESSAGES.append({'id': m.id, 'campaign_id': m.campaign_id, 'author': m.author, 'text': m.text, 'timestamp': m.timestamp, 'uuid': getattr(m, 'uuid', None)})
        except Exception:
            pass
        return m
    finally:
        s.close()


def db_get_memberships_for_user(uid):
    s = SessionLocal()
    try:
        return s.query(Membership).filter(Membership.user_id == uid).all()
    finally:
        s.close()


def db_get_messages_for_campaign(cid):
    s = SessionLocal()
    try:
        return s.query(Message).filter(Message.campaign_id == cid).order_by(Message.id.asc()).all()
    finally:
        s.close()

# Database setup (use DATABASE_URL or fallback to local SQLite file)
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    DATABASE_URL = 'sqlite:///./data.db'

engine = create_engine(DATABASE_URL, echo=False, connect_args={'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


# Models
class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True)
    username = Column(String)
    password_hash = Column(String)
    character = relationship('Character', back_populates='user', uselist=False)


class Campaign(Base):
    __tablename__ = 'campaigns'
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, nullable=True)
    name = Column(String)
    owner = Column(Integer)
    invite_code = Column(String)
    characters = relationship('Character', back_populates='campaign')


class Membership(Base):
    __tablename__ = 'memberships'
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, nullable=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    role = Column(String)


class Character(Base):
    __tablename__ = 'characters'
    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(String(36), unique=True, index=True, nullable=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    name = Column(String)
    maxHp = Column(Integer)
    portrait = Column(Text)
    # freeform JSON blob for attributes, skills, inventory, etc.
    data = Column(Text)
    user = relationship('User', back_populates='character')
    campaign = relationship('Campaign', back_populates='characters')


class Message(Base):
    __tablename__ = 'messages'
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'))
    author = Column(String)
    text = Column(Text)
    timestamp = Column(String)


# create tables if missing
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    # Log exception to console for visibility in container/platform logs.
    print('Warning: could not create DB tables at startup:', str(e))

# Lightweight DB helpers (used in endpoints below)
def db_get_user_by_email(email):
    s = SessionLocal()
    try:
        return s.query(User).filter(User.email == email).first()
    finally:
        s.close()

def db_get_user_by_id(uid):
    s = SessionLocal()
    try:
        return s.query(User).filter(User.id == uid).first()
    finally:
        s.close()

def db_create_user(email, username, password_hash):
    s = SessionLocal()
    try:
        import uuid as _uuid
        u = User(email=email, username=username, password_hash=password_hash, uuid=str(_uuid.uuid4()))
        s.add(u)
        s.commit()
        s.refresh(u)
        return u
    finally:
        s.close()


# Campaign / Membership / Message DB helpers
def db_create_campaign(name, owner_id, invite_code=None):
    s = SessionLocal()
    try:
        import uuid as _uuid
        ic = invite_code or f"INV-{int(datetime.datetime.utcnow().timestamp()) % 100000:05d}"
        c = Campaign(name=name, owner=owner_id, invite_code=ic, uuid=str(_uuid.uuid4()))
        s.add(c)
        s.commit()
        s.refresh(c)
        return c
    finally:
        s.close()

def db_get_campaign_by_name(name):
    s = SessionLocal()
    try:
        return s.query(Campaign).filter(Campaign.name == name).first()
    finally:
        s.close()

def db_get_campaign_by_id(cid):
    s = SessionLocal()
    try:
        return s.query(Campaign).filter(Campaign.id == cid).first()
    finally:
        s.close()

def db_get_campaigns_for_user(uid):
    s = SessionLocal()
    try:
        mids = s.query(Membership).filter(Membership.user_id == uid).all()
        camp_ids = [m.campaign_id for m in mids if getattr(m, 'campaign_id', None) is not None]
        if not camp_ids:
            return []
        camps = s.query(Campaign).filter(Campaign.id.in_(camp_ids)).all()
        return camps
    finally:
        s.close()


@app.route('/api/redis/ping', methods=['GET'])
def ping_redis():
    """Ping the configured Redis instance if present. Returns 200 with {ok: True}
    when reachable, or 503 when not configured or unreachable. Does not return
    any credentials or secrets."""
    url = os.environ.get('REDIS_URL') or os.environ.get('REDIS_URI')
    if not url:
        return jsonify({'ok': False, 'message': 'REDIS_URL not configured'}), 503


    @app.route('/api/debug/token', methods=['GET'])
    def debug_token():
        """Debug-only endpoint: returns request headers and decoded JWT payload (no secrets).
        Intended for short-term debugging in staging; remove before production use.
        """
        headers = {k: v for k, v in request.headers.items()}
        token = None
        try:
            auth_header = request.headers.get('Authorization') or request.environ.get('HTTP_AUTHORIZATION')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header.split(' ', 1)[1]
            elif auth_header:
                token = auth_header
        except Exception:
            token = None
        payload = None
        if token:
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            except Exception as e:
                payload = {'_decode_error': str(e)}
        return jsonify({'headers': headers, 'token_payload': payload})
    try:
        r = redis.from_url(url, socket_timeout=5)
        if r.ping():
            return jsonify({'ok': True}), 200
        return jsonify({'ok': False, 'message': 'ping failed'}), 502
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 502


@app.route('/api/health', methods=['GET'])
def health():
    # Basic health: check DB connectivity and optional Redis reachability.
    # Return 200 when DB reachable. In production we want a clear 503 when
    # the database is unavailable so orchestration / monitors can act.
    # Do not include secrets in the response.
    health = {'ok': False, 'database': False, 'redis': False}
    # Check DB
    try:
        # Use engine connection for a lightweight check
        from sqlalchemy import text as _text
        conn = engine.connect()
        try:
            conn.execute(_text('SELECT 1'))
            health['database'] = True
        finally:
            conn.close()
    except Exception:
        health['database'] = False
    # Check Redis if configured (non-fatal)
    try:
        url = os.environ.get('REDIS_URL') or os.environ.get('REDIS_URI')
        if url:
            r = redis.from_url(url, socket_timeout=2)
            try:
                if r.ping():
                    health['redis'] = True
            except Exception:
                health['redis'] = False
        else:
            health['redis'] = False
    except Exception:
        health['redis'] = False

    health['ok'] = health['database']
    if health['ok']:
        return jsonify(health), 200
    # If DB is unavailable return 503 so monitors know the instance is unhealthy.
    return jsonify(health), 503


# Lightweight debug inspector. Safe for temporary use in production to help
# confirm routing and header forwarding. Does NOT return Authorization header
# value or any secrets — only booleans and route metadata.
@app.route('/api/_debug/inspect', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def debug_inspect():
    # Optional query param `path` to inspect a different path than the current one.
    inspect_path = request.args.get('path') or request.path
    inspect_method = (request.args.get('method') or request.method).upper()
    # Find matching Flask rules for the provided path (exact rule matches only).
    matches = []
    try:
        for r in app.url_map.iter_rules():
            if r.rule == inspect_path:
                methods = list(r.methods) if r.methods is not None else []
                matches.append({'rule': r.rule, 'endpoint': r.endpoint, 'methods': sorted(methods)})
    except Exception:
        matches = []
    return jsonify({
        'ok': True,
        'inspected_path': inspect_path,
        'inspected_method': inspect_method,
        'auth_header_present': bool(request.headers.get('Authorization')),
        'matches': matches,
    })


# Temporary, gated endpoint to help confirm that multiple running instances
# share the same JWT secret without revealing the secret itself. It returns
# a SHA256 hex digest of the configured `JWT_SECRET` value. This endpoint
# is only enabled when the environment variable `DEBUG_SECRET_HASH` is set
# to "true" or when the app is running in a non-production environment.
@app.route('/api/_debug/secret-hash', methods=['GET'])
def debug_secret_hash():
    enabled = (os.environ.get('DEBUG_SECRET_HASH', '').lower() == 'true') or (APP_ENV != 'production')
    if not enabled:
        # Hide existence in production by returning 404
        return jsonify({'message': 'not found'}), 404
    try:
        import hashlib
        secret = JWT_SECRET or ''
        h = hashlib.sha256(secret.encode('utf-8')).hexdigest()
    except Exception:
        h = None
    return jsonify({'ok': True, 'secret_hash': h}), 200


@app.route('/api/env', methods=['GET'])
def show_env():
    # Safe debug endpoint: do not return secrets. Useful to confirm what the
    # running instance sees for CORS and optional services.
    return jsonify({
        'app_env': APP_ENV,
        'allowed_origins': ALLOWED_ORIGINS,
        'database_url_set': bool(os.environ.get('DATABASE_URL')),
        'redis_url_set': bool(os.environ.get('REDIS_URL') or os.environ.get('REDIS_URI'))
    })


# Serve SPA static files when available (single-host mode)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def spa(path):
    # If the SPA is built and file exists, serve it. Otherwise 404 for non-API paths.
    if app.static_folder and os.path.exists(app.static_folder):
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        index = os.path.join(app.static_folder, 'index.html')
        if os.path.exists(index):
            return send_from_directory(app.static_folder, 'index.html')
    # If no built frontend present, return a helpful message for GET /
    if path == '' or path == 'index.html':
        return jsonify({"message": "Frontend not built. Run `cd frontend && npm run build` and restart backend."}), 200
    return jsonify({"message": "Not found"}), 404


@app.route('/api/npcs', methods=['GET'])
def list_npcs():
    return jsonify(NPCS)


@app.route('/api/npcs', methods=['POST'])
def create_npc():
    global NEXT_ID
    data = request.get_json() or {}
    name = data.get('name')
    title = data.get('title')
    if not name or not title:
        return jsonify({"error": "name and title are required"}), 400
    npc = {"id": NEXT_ID, "name": name, "title": title}
    NEXT_ID += 1
    NPCS.append(npc)
    return jsonify(npc), 201


# Auth endpoints
@app.route('/api/auth/register', methods=['POST'])
def register():
    global NEXT_USER_ID
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    username = data.get('username')
    if not email or not password or not username:
        return jsonify({"message": "email, username and password are required"}), 400
    # check duplicate
    # prefer DB-backed users if available. If the DB is unavailable, fall
    # back to the in-memory store instead of raising a 500.
    try:
        existing = db_get_user_by_email(email)
    except Exception:
        existing = None
    if existing:
        return jsonify({"message": "email already exists"}), 400
    # create in DB; if DB operations fail, only allow in-memory fallback in dev
    start_time = time.time()
    pwd_hash_start = time.time()
    pwd_hash = generate_password_hash(password)
    pwd_hash_end = time.time()
    try:
        db_start = time.time()
        new_user = db_create_user(email, username, pwd_hash)
        db_end = time.time()
        # add a simple in-memory mirror for older endpoints still using USERS (dev friendly)
        mirror = {'id': new_user.id, 'email': new_user.email, 'username': new_user.username, 'password_hash': new_user.password_hash}
        # ensure NEXT_USER_ID stays ahead of DB ids for in-memory mirrors
        try:
            new_id = getattr(new_user, 'id', None)
            if new_id is not None:
                NEXT_USER_ID = max(NEXT_USER_ID, int(new_id) + 1)
        except Exception:
            pass
        # Only append mirror in development to avoid relying on in-memory state in prod
        if APP_ENV == 'development':
            USERS.append(mirror)
        token = make_token(mirror)
        total_end = time.time()
        if os.environ.get('DEBUG_AUTH') == 'true':
            try:
                print(f"Auth timing (register): hash={pwd_hash_end-pwd_hash_start:.3f}s db={db_end-db_start:.3f}s total={total_end-start_time:.3f}s (db)")
            except Exception:
                pass
        # return token and user object for immediate client usage
        return jsonify({"token": token, "user": mirror}), 201
    except Exception:
        # DB failed. In development, fall back to the in-memory user store so local
        # testing remains convenient. In production return 503 so callers see the
        # database is unavailable instead of silently using in-memory data.
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        db_fail_time = time.time()
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
        total_end = time.time()
        if os.environ.get('DEBUG_AUTH') == 'true':
            try:
                print(f"Auth timing (register): hash={pwd_hash_end-pwd_hash_start:.3f}s db_fail_delay={total_end-db_fail_time:.3f}s total={total_end-start_time:.3f}s (fallback)")
            except Exception:
                pass
        return jsonify({"token": token, "user": user}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({"message": "email and password are required"}), 400
    # prefer DB lookup; record DB errors so we can decide whether to fallback
    lookup_start = time.time()
    db_error = False
    try:
        dbu = db_get_user_by_email(email)
    except Exception:
        dbu = None
        db_error = True
    lookup_end = time.time()
    if dbu:
        # Optional debug logging for auth (do not enable in production logs unless safe)
        try:
            if os.environ.get('DEBUG_AUTH') == 'true':
                print(f"Auth debug: found DB user id={getattr(dbu,'id',None)} email={getattr(dbu,'email',None)} lookup_time={lookup_end-lookup_start:.3f}s")
        except Exception:
            pass
        pw_start = time.time()
        ok = check_password_hash(str(dbu.password_hash), password)
        pw_end = time.time()
        if not ok:
            if os.environ.get('DEBUG_AUTH') == 'true':
                print(f'Auth debug: password check failed for DB user pw_time={pw_end-pw_start:.3f}s')
            return jsonify({"message": "invalid credentials"}), 401
        # create mirror token payload
        mirror = {'id': dbu.id, 'email': dbu.email, 'username': dbu.username}
        token = make_token(mirror)
        if os.environ.get('DEBUG_AUTH') == 'true':
            try:
                print(f"Auth timing (login): lookup={lookup_end-lookup_start:.3f}s pw_check={pw_end-pw_start:.3f}s")
            except Exception:
                pass
        # return token and user object so client can display user fields immediately
        return jsonify({"token": token, "user": mirror}), 200
    # If DB errored and we're not in development, surface the DB unavailability
    if db_error and APP_ENV != 'development':
        return jsonify({'message': 'database unavailable'}), 503

    user = next((u for u in USERS if u['email'] == email), None)
    if not user or not check_password_hash(user['password_hash'], password):
        if os.environ.get('DEBUG_AUTH') == 'true':
            print(f"Auth debug: in-memory user lookup for {email} returned {bool(user)} and password_check={user and check_password_hash(user['password_hash'], password)}")
        return jsonify({"message": "invalid credentials"}), 401
    token = make_token(user)
    return jsonify({"token": token, "user": user}), 200


# Dev-only helper endpoints: create and delete a dev user. These are only active
# when APP_ENV == 'development' to avoid accidental use in production.
@app.route('/api/_dev/create_user', methods=['POST'])
def dev_create_user():
    if APP_ENV != 'development':
        return jsonify({'message': 'not found'}), 404
    data = request.get_json() or {}
    email = data.get('email')
    username = data.get('username')
    password = data.get('password')
    if not email or not username or not password:
        return jsonify({'message': 'email, username and password required'}), 400
    # create user (reuse register logic)
    try:
        res = register()
        return res
    except Exception as e:
        return jsonify({'message': 'error creating user', 'error': str(e)}), 500


@app.route('/api/_dev/delete_user', methods=['DELETE'])
def dev_delete_user():
    if APP_ENV != 'development':
        return jsonify({'message': 'not found'}), 404
    data = request.get_json() or {}
    email = data.get('email')
    if not email:
        return jsonify({'message': 'email required'}), 400
    # Attempt to delete from DB if available
    try:
        dbu = db_get_user_by_email(email)
        if dbu:
            s = SessionLocal()
            try:
                s.delete(dbu)
                s.commit()
            finally:
                s.close()
            return jsonify({'ok': True}), 200
    except Exception:
        pass
    # Fallback to in-memory USERS
    global USERS
    before = len(USERS)
    USERS = [u for u in USERS if u.get('email') != email]
    after = len(USERS)
    if after < before:
        return jsonify({'ok': True}), 200
    return jsonify({'message': 'user not found'}), 404


# ----- Campaigns & membership endpoints (dev in-memory) -----
@app.route('/api/campaigns', methods=['GET'])
def list_campaigns():
    user = get_user_from_auth()
    if not user:
        return jsonify([])
    # Prefer DB-backed campaigns when available. If DB is unavailable, in
    # development fall back to in-memory campaigns; in production return 503.
    try:
        camps = db_get_campaigns_for_user(user['id'])
        return jsonify([{'id': c.id, 'uuid': getattr(c, 'uuid', None), 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code} for c in camps])
    except Exception:
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        member_ids = [m['campaign_id'] for m in MEMBERSHIPS if m['user_id'] == user['id']]
        return jsonify([c for c in CAMPAIGNS if c['id'] in member_ids])


@app.route('/api/campaigns', methods=['POST'])
def create_campaign():
    global NEXT_CAMPAIGN_ID
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({"message": "name required"}), 400
    # Try DB persistence first. If DB is down, reject in production.
    try:
        c = db_create_campaign(name, user['id'])
        db_create_membership(c.id, user['id'], role='owner')
        return jsonify({'id': c.id, 'uuid': getattr(c, 'uuid', None), 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code}), 201
    except Exception:
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        camp = { 'id': NEXT_CAMPAIGN_ID, 'name': name, 'owner': user['id'], 'invite_code': f"INV-{NEXT_CAMPAIGN_ID:04d}" }
        NEXT_CAMPAIGN_ID += 1
        CAMPAIGNS.append(camp)
        # add membership for creator
        MEMBERSHIPS.append({'campaign_id': camp['id'], 'user_id': user['id'], 'role': 'owner'})
        return jsonify(camp), 201


@app.route('/api/campaigns/test/join', methods=['POST'])
def join_or_create_test_campaign():
    """Create a shared 'Test Campaign' if missing and add the current user as a member.
    This endpoint is helpful for quick onboarding in production without manual admin steps.
    """
    global NEXT_CAMPAIGN_ID
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401

    # Find an existing test campaign by canonical name
    test_name = 'Test Campaign'
    try:
        c = db_get_campaign_by_name(test_name)
        if not c:
            c = db_create_campaign(test_name, user['id'], invite_code=f"TEST-{int(datetime.datetime.utcnow().timestamp()) % 10000:04d}")
        # ensure membership
        db_create_membership(c.id, user['id'], role='player')
        return jsonify({'id': c.id, 'uuid': getattr(c, 'uuid', None), 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code})
    except Exception:
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        camp = next((c for c in CAMPAIGNS if c.get('name') == test_name), None)
        if not camp:
            camp = { 'id': NEXT_CAMPAIGN_ID, 'name': test_name, 'owner': user['id'], 'invite_code': f"TEST-{NEXT_CAMPAIGN_ID:04d}" }
            NEXT_CAMPAIGN_ID += 1
            CAMPAIGNS.append(camp)
        if not any(m for m in MEMBERSHIPS if m['campaign_id'] == camp['id'] and m['user_id'] == user['id']):
            MEMBERSHIPS.append({'campaign_id': camp['id'], 'user_id': user['id'], 'role': 'player'})
        return jsonify(camp)


@app.route('/api/campaigns/public', methods=['GET'])
def public_campaigns():
    # Return all campaigns (public listing). For production, add pagination/filters.
    try:
        s = SessionLocal()
        try:
            camps = s.query(Campaign).all()
            return jsonify([{'id': c.id, 'uuid': getattr(c, 'uuid', None), 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code} for c in camps])
        finally:
            s.close()
    except Exception:
        return jsonify(CAMPAIGNS)


@app.route('/api/campaigns/<cid>/join', methods=['POST'])
def join_campaign_by_id(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
    try:
        # accept numeric id or uuid
        if isinstance(cid, int) or (isinstance(cid, str) and cid.isdigit()):
            c = db_get_campaign_by_id(int(cid))
        else:
            s = SessionLocal()
            try:
                c = s.query(Campaign).filter(Campaign.uuid == str(cid)).first() or s.query(Campaign).filter(Campaign.name == cid).first()
            finally:
                s.close()
        if not c:
            return jsonify({"message": "campaign not found"}), 404
        db_create_membership(c.id, user['id'], role='player')
        return jsonify({'id': c.id, 'uuid': getattr(c, 'uuid', None), 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code})
    except Exception:
        camp = next((c for c in CAMPAIGNS if c['id'] == cid), None)
        if not camp:
            return jsonify({"message": "campaign not found"}), 404
        if not any(m for m in MEMBERSHIPS if m['campaign_id'] == camp['id'] and m['user_id'] == user['id']):
            MEMBERSHIPS.append({'campaign_id': camp['id'], 'user_id': user['id'], 'role': 'player'})
        return jsonify(camp)



@app.route('/api/campaigns/join', methods=['POST'])
def join_campaign():
    data = request.get_json() or {}
    code = data.get('code')
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
    if not code:
        return jsonify({"message": "code required"}), 400
    try:
        # try by invite code first
        s = SessionLocal()
        try:
            c = s.query(Campaign).filter((Campaign.invite_code == code) | (Campaign.id == (int(code) if str(code).isdigit() else -1))).first()
        finally:
            s.close()
        if not c:
            return jsonify({"message": "invalid code"}), 404
        db_create_membership(c.id, user['id'], role='player')
        return jsonify({'id': c.id, 'uuid': getattr(c, 'uuid', None), 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code})
    except Exception:
        camp = next((c for c in CAMPAIGNS if c.get('invite_code') == code or str(c.get('id')) == str(code)), None)
        if not camp:
            return jsonify({"message": "invalid code"}), 404
        if not any(m for m in MEMBERSHIPS if m['campaign_id'] == camp['id'] and m['user_id'] == user['id']):
            MEMBERSHIPS.append({'campaign_id': camp['id'], 'user_id': user['id'], 'role': 'player'})
        return jsonify(camp)


@app.route('/api/campaigns/<cid>/messages', methods=['GET'])
def list_campaign_messages(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify([]), 401
    # simple membership check
    try:
        # check membership via DB
        mids = db_get_memberships_for_user(user['id'])
        # accept numeric id or uuid/name
        campaign_id_to_check = None
        if isinstance(cid, int) or (isinstance(cid, str) and cid.isdigit()):
            campaign_id_to_check = int(cid)
        else:
            s = SessionLocal()
            try:
                cb = s.query(Campaign).filter(Campaign.uuid == str(cid)).first() or s.query(Campaign).filter(Campaign.name == cid).first()
                if cb:
                    campaign_id_to_check = cb.id
            finally:
                s.close()
        if campaign_id_to_check is None or not any((getattr(m, 'campaign_id', None) == campaign_id_to_check) for m in mids):
            return jsonify({"message": "forbidden"}), 403
        msgs = db_get_messages_for_campaign(campaign_id_to_check)
        return jsonify([{'id': m.id, 'campaign_id': m.campaign_id, 'author': m.author, 'text': m.text, 'timestamp': m.timestamp, 'uuid': getattr(m, 'uuid', None) if hasattr(m, 'uuid') else None} for m in msgs])
    except Exception:
        if not any(m for m in MEMBERSHIPS if m['campaign_id'] == cid and m['user_id'] == user['id']):
            return jsonify({"message": "forbidden"}), 403
        msgs = [m for m in MESSAGES if m['campaign_id'] == cid]
        return jsonify(msgs)


@app.route('/api/campaigns/<cid>/messages', methods=['POST'])
def post_campaign_message(cid):
    global NEXT_MESSAGE_ID
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
    data = request.get_json() or {}
    body = data.get('text') or data.get('body') or data.get('message') or ''
    try:
        # ensure membership via DB
        mids = db_get_memberships_for_user(user['id'])
        # accept numeric id or uuid/name for campaign identification
        campaign_id_to_check = None
        if isinstance(cid, int) or (isinstance(cid, str) and cid.isdigit()):
            campaign_id_to_check = int(cid)
        else:
            s = SessionLocal()
            try:
                cb = s.query(Campaign).filter(Campaign.uuid == str(cid)).first() or s.query(Campaign).filter(Campaign.name == cid).first()
                if cb:
                    campaign_id_to_check = cb.id
            finally:
                s.close()
        if campaign_id_to_check is None or not any((getattr(m, 'campaign_id', None) == campaign_id_to_check) for m in mids):
            return jsonify({"message": "forbidden"}), 403
        m = db_create_message(campaign_id_to_check, user['username'], body)
        msg = {'id': m.id, 'campaign_id': m.campaign_id, 'author': m.author, 'text': m.text, 'timestamp': m.timestamp, 'uuid': getattr(m, 'uuid', None)}
    except Exception:
        if not any(m for m in MEMBERSHIPS if m['campaign_id'] == cid and m['user_id'] == user['id']):
            return jsonify({"message": "forbidden"}), 403
        msg = {
            'id': NEXT_MESSAGE_ID,
            'campaign_id': cid,
            'author': user['username'],
            'text': body,
            'timestamp': datetime.datetime.utcnow().isoformat()
        }
        NEXT_MESSAGE_ID += 1
        MESSAGES.append(msg)
    # Emit to campaign room via SocketIO so connected clients receive it
    try:
        # pass room as third positional arg to avoid static linter warnings
        socketio.emit('campaign_message', msg, f'campaign_{cid}')
    except Exception:
        pass
    return jsonify(msg), 201



@socketio.on('join')
def on_join(data):
    # data: { campaign: <id>, token?: <jwt> }
    cid = data.get('campaign')
    if not cid: return
    room = f'campaign_{cid}'
    join_room(room)


@socketio.on('leave')
def on_leave(data):
    cid = data.get('campaign')
    if not cid: return
    room = f'campaign_{cid}'
    leave_room(room)


@app.route('/api/campaigns/<cid>/characters', methods=['GET','POST'])
def campaign_characters(cid):
    """Unified characters endpoint: GET lists characters, POST creates a character."""
    user = get_user_from_auth()
    if not user:
        return jsonify([]) if request.method == 'GET' else (jsonify({"message": "unauthorized"}), 401)
    if request.method == 'GET':
        try:
            s = SessionLocal()
            try:
                # resolve campaign id from numeric id, uuid, or name
                if isinstance(cid, str) and cid.isdigit():
                    campaign_id = int(cid)
                else:
                    cb = s.query(Campaign).filter(Campaign.uuid == str(cid)).first() or s.query(Campaign).filter(Campaign.name == cid).first()
                    campaign_id = cb.id if cb else None
                if campaign_id is None:
                    return jsonify([])
                rows = s.query(Character).filter(Character.campaign_id == campaign_id).all()
                out = []
                for r in rows:
                    try:
                        blob_text = getattr(r, 'data', None)
                        blob = json.loads(blob_text) if blob_text else {}
                    except Exception:
                        blob = {}
                    obj = {
                        'id': r.id,
                        'uuid': getattr(r, 'uuid', None),
                        'campaign_id': r.campaign_id,
                        'user_id': r.user_id,
                        'name': r.name,
                        'maxHp': r.maxHp,
                        'portrait': r.portrait,
                        **(blob if isinstance(blob, dict) else {})
                    }
                    out.append(obj)
                return jsonify(out)
            finally:
                s.close()
        except Exception:
            chars = [c for c in CHARACTERS if c.get('campaign_id') == cid]
            return jsonify(chars)
    # POST flow
    if request.method == 'POST':
        global NEXT_CHARACTER_ID
        try:
            # resolve campaign id
            if isinstance(cid, str) and cid.isdigit():
                campaign_id_to_check = int(cid)
            else:
                s = SessionLocal()
                try:
                    cb = s.query(Campaign).filter(Campaign.uuid == str(cid)).first() or s.query(Campaign).filter(Campaign.name == cid).first()
                    campaign_id_to_check = cb.id if cb else None
                finally:
                    s.close()
        except Exception:
            campaign_id_to_check = None
        # membership check: prefer DB-backed memberships when possible
        try:
            mids = db_get_memberships_for_user(user['id'])
            if campaign_id_to_check is None or not any((getattr(m, 'campaign_id', None) == campaign_id_to_check) for m in mids):
                # fallback to in-memory memberships mirror
                if not any(m for m in MEMBERSHIPS if m['campaign_id'] == campaign_id_to_check and m['user_id'] == user['id']):
                    return jsonify({"message": "forbidden"}), 403
        except Exception:
            if not any(m for m in MEMBERSHIPS if m['campaign_id'] == campaign_id_to_check and m['user_id'] == user['id']):
                return jsonify({"message": "forbidden"}), 403
        data = request.get_json() or {}
        name = data.get('name') or ''
        maxHp = data.get('maxHp') or 0
        portrait = data.get('portrait') or ''
        try:
            maxHp = int(maxHp)
        except Exception:
            maxHp = 0
        blob = {
            'attributes': data.get('attributes') or {},
            'skills': data.get('skills') or {},
            'skillScores': data.get('skillScores') or data.get('skillVals') or {},
            'inventory': data.get('inventory') or []
        }
        try:
            s = SessionLocal()
            try:
                import uuid as _uuid
                c = Character(campaign_id=campaign_id_to_check, user_id=user['id'], name=name, maxHp=maxHp, portrait=portrait, data=json.dumps(blob), uuid=str(_uuid.uuid4()))
                s.add(c)
                s.commit()
                s.refresh(c)
                res = {'id': c.id, 'uuid': getattr(c, 'uuid', None), 'campaign_id': c.campaign_id, 'user_id': c.user_id, 'name': c.name, 'maxHp': c.maxHp, 'portrait': c.portrait, **blob}
                CHARACTERS.append(res)
                try:
                    cid_val = getattr(c, 'id', None)
                    if cid_val is not None:
                        NEXT_CHARACTER_ID = max(NEXT_CHARACTER_ID, int(cid_val) + 1)
                except Exception:
                    pass
                try:
                    room = f'campaign_{c.campaign_id}'
                    socketio.emit('character_updated', {'campaign_id': c.campaign_id, 'user_id': c.user_id, 'character_id': c.id, 'character': res}, room)
                except Exception:
                    pass
                return jsonify(res), 201
            finally:
                s.close()
        except Exception:
            char = {
                'id': NEXT_CHARACTER_ID,
                'campaign_id': campaign_id_to_check,
                'user_id': user['id'],
                'name': name,
                'maxHp': maxHp,
                'portrait': portrait,
                **blob
            }
            NEXT_CHARACTER_ID += 1
            CHARACTERS.append(char)
            try:
                room = f'campaign_{campaign_id_to_check}'
                socketio.emit('character_updated', {'campaign_id': campaign_id_to_check, 'user_id': user['id'], 'character_id': char.get('id'), 'character': char}, room)
            except Exception:
                pass
            return jsonify(char), 201
    # Fallback: ensure a Response is always returned (avoids static type None possibility)
    return jsonify({'message': 'method not allowed'}), 405



@app.route('/api/users/me/active-campaign', methods=['PUT'])
def set_active_campaign():
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
    data = request.get_json() or {}
    cid = data.get('campaign')
    # accept campaign id or name
    camp = None
    db_error = False
    if isinstance(cid, int) or (isinstance(cid, str) and cid.isdigit()):
        # try DB first
        try:
            db_c = db_get_campaign_by_id(int(cid))
            if db_c:
                camp = {'id': db_c.id, 'name': db_c.name, 'owner': db_c.owner, 'invite_code': db_c.invite_code}
        except Exception:
            db_error = True
            camp = None
            if APP_ENV == 'development':
                camp = next((c for c in CAMPAIGNS if c['id'] == int(cid)), None)
    else:
        try:
            db_c = db_get_campaign_by_name(cid) if cid is not None else None
            if db_c:
                camp = {'id': db_c.id, 'name': db_c.name, 'owner': db_c.owner, 'invite_code': db_c.invite_code}
        except Exception:
            db_error = True
            camp = None
            if APP_ENV == 'development':
                camp = next((c for c in CAMPAIGNS if c['name'] == cid), None)
    if not camp and cid is not None:
        return jsonify({"message": "campaign not found"}), 404
    # If DB-backed user exists, return a refreshed token with claim; do not attempt to modify DB user object here
    dbu = None
    try:
        dbu = db_get_user_by_id(user['id'])
    except Exception:
        dbu = None
    # If DB lookup succeeded and returned a user, return a refreshed token
    if dbu:
        mirror = {'id': dbu.id, 'email': dbu.email, 'username': dbu.username}
        if camp:
            mirror['active_campaign'] = camp['name']
        token = make_token(mirror)
        return jsonify({'token': token, 'user': mirror}), 200

    # DB did not provide a user. If the DB errored and we're in production,
    # surface the failure so clients know the DB is unavailable.
    if db_error and APP_ENV != 'development':
        return jsonify({'message': 'database unavailable'}), 503

    # Otherwise (development), update the in-memory user mirror and return
    u = next((u for u in USERS if u['id'] == user['id']), None)
    if u is not None:
        u['active_campaign'] = camp['id'] if camp else None
    mirror = {'id': user['id'], 'email': user.get('email'), 'username': user.get('username')}
    if camp:
        mirror['active_campaign'] = camp['name']
    token = make_token(mirror)
    return jsonify({'token': token, 'user': mirror}), 200


@app.route('/api/users/me/character', methods=['GET'])
def get_my_character():
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
    # Prefer DB-backed character when possible
    try:
        s = SessionLocal()
        try:
            ch = s.query(Character).filter(Character.user_id == user['id']).first()
            if ch:
                try:
                    blob_text = getattr(ch, 'data', None)
                    blob = json.loads(blob_text) if blob_text else {}
                except Exception:
                    blob = {}
                res = {'id': ch.id, 'campaign_id': ch.campaign_id, 'user_id': ch.user_id, 'name': ch.name, 'maxHp': ch.maxHp, 'portrait': ch.portrait, **(blob if isinstance(blob, dict) else {})}
                return jsonify(res), 200
        finally:
            s.close()
    except Exception:
        # If DB is unavailable, in production surface the error; in dev fall back
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
    # Fallback to in-memory mirror on user or global CHARACTERS (dev only)
    ch = user.get('character') or next((c for c in CHARACTERS if c.get('user_id') == user['id']), None)
    if ch:
        return jsonify(ch), 200
    return jsonify({}), 404


@app.route('/api/users/me/character', methods=['PUT'])
def set_my_character():
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
    data = request.get_json() or {}
    name = data.get('name')
    maxHp = data.get('maxHp')
    portrait = data.get('portrait')
    attributes = data.get('attributes') or {}
    skills = data.get('skills') or {}
    skillScores = data.get('skillScores') or data.get('skillVals') or {}
    inventory = data.get('inventory') or []
    # validate
    try:
        maxHp = int(maxHp) if maxHp is not None else 0
    except Exception:
        return jsonify({'message': 'maxHp must be a number'}), 400
    # Try DB persistence first
    try:
        s = SessionLocal()
        try:
            existing = s.query(Character).filter(Character.user_id == user['id']).first()
            if existing:
                setattr(existing, 'name', name or getattr(existing, 'name'))
                setattr(existing, 'maxHp', maxHp)
                setattr(existing, 'portrait', portrait or getattr(existing, 'portrait'))
                # update blob
                blob = {'attributes': attributes, 'skills': skills, 'skillScores': skillScores, 'inventory': inventory}
                try:
                    setattr(existing, 'data', json.dumps(blob))
                except Exception:
                    pass
                s.add(existing)
                s.commit()
                s.refresh(existing)
                ch = existing
            else:
                campaign_id = data.get('campaign_id')
                blob = {'attributes': attributes, 'skills': skills, 'skillScores': skillScores, 'inventory': inventory}
                ch = Character(campaign_id=campaign_id, user_id=user['id'], name=name or '', maxHp=maxHp, portrait=portrait or '', data=json.dumps(blob))
                s.add(ch)
                s.commit()
                s.refresh(ch)
            res = {'id': ch.id, 'campaign_id': ch.campaign_id, 'user_id': ch.user_id, 'name': ch.name, 'maxHp': ch.maxHp, 'portrait': ch.portrait}
            # attach blob if present
            try:
                blob_text = getattr(ch, 'data', None)
                blob = json.loads(blob_text) if blob_text else {}
            except Exception:
                blob = {}
            if isinstance(blob, dict):
                res.update(blob)
            # emit socket event for campaign room if campaign_id present
            try:
                room = f'campaign_{res.get("campaign_id")}'
                socketio.emit('character_updated', {'campaign_id': res.get('campaign_id'), 'user_id': res.get('user_id'), 'character_id': res.get('id'), 'character': res}, room)
            except Exception:
                pass
            # mirror into in-memory list for demo compatibility
            existing_mem = next((c for c in CHARACTERS if c.get('id') == res['id']), None)
            if not existing_mem:
                CHARACTERS.append(res)
            return jsonify(res), 200
        finally:
            s.close()
    except Exception:
        # In case of DB failure, only fall back to in-memory in development.
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        # fallback to in-memory
        existing = next((c for c in CHARACTERS if c.get('user_id') == user['id']), None)
        if existing:
            existing['name'] = name or existing.get('name')
            existing['maxHp'] = maxHp
            existing['portrait'] = portrait or existing.get('portrait')
            existing['attributes'] = attributes
            existing['skills'] = skills
            existing['skillScores'] = skillScores
            existing['inventory'] = inventory
            try:
                room = f'campaign_{existing.get("campaign_id")}'
                socketio.emit('character_updated', {'campaign_id': existing.get('campaign_id'), 'user_id': existing.get('user_id'), 'character_id': existing.get('id'), 'character': existing}, room)
            except Exception:
                pass
            return jsonify(existing), 200
        global NEXT_CHARACTER_ID
        ch = {'id': NEXT_CHARACTER_ID, 'campaign_id': data.get('campaign_id'), 'user_id': user['id'], 'name': name or '', 'maxHp': maxHp, 'portrait': portrait or '', 'attributes': attributes, 'skills': skills, 'skillScores': skillScores, 'inventory': inventory}
        NEXT_CHARACTER_ID += 1
        CHARACTERS.append(ch)
        try:
            room = f'campaign_{ch.get("campaign_id")}'
            socketio.emit('character_updated', {'campaign_id': ch.get('campaign_id'), 'user_id': ch.get('user_id'), 'character_id': ch.get('id'), 'character': ch}, room)
        except Exception:
            pass
        return jsonify(ch), 201


if __name__ == '__main__':
    # Port defaults to 5001 to match your dev setup
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('DEBUG', 'true' if APP_ENV == 'development' else 'false').lower() == 'true'
    # Seed demo users/campaigns in development for quick multi-user testing
    def seed_demo_data():
        global NEXT_USER_ID, NEXT_CAMPAIGN_ID, NEXT_MESSAGE_ID
        if APP_ENV != 'development':
            return
        if USERS:
            return
        print('Seeding demo users and campaign for development...')
        # create two demo users
        u1 = {'id': NEXT_USER_ID, 'email': 'alice@example.com', 'username': 'alice', 'password_hash': generate_password_hash('password')}
        NEXT_USER_ID += 1
        u2 = {'id': NEXT_USER_ID, 'email': 'bob@example.com', 'username': 'bob', 'password_hash': generate_password_hash('password')}
        NEXT_USER_ID += 1
        USERS.extend([u1, u2])
        # create a demo campaign and memberships
        camp = {'id': NEXT_CAMPAIGN_ID, 'name': 'Demo Campaign', 'owner': u1['id'], 'invite_code': f'INV-{NEXT_CAMPAIGN_ID:04d}'}
        NEXT_CAMPAIGN_ID += 1
        CAMPAIGNS.append(camp)
        MEMBERSHIPS.append({'campaign_id': camp['id'], 'user_id': u1['id'], 'role': 'owner'})
        MEMBERSHIPS.append({'campaign_id': camp['id'], 'user_id': u2['id'], 'role': 'player'})
        # add a starter message
        MESSAGES.append({'id': NEXT_MESSAGE_ID, 'campaign_id': camp['id'], 'author': 'alice', 'text': 'Welcome to the demo campaign!', 'timestamp': datetime.datetime.utcnow().isoformat()})
        NEXT_MESSAGE_ID += 1
        # print tokens for quick login
        t1 = make_token(u1)
        t2 = make_token(u2)
        print('\nDevelopment demo users:')
        print('  alice  -> email: alice@example.com  password: password')
        print('  bob    -> email: bob@example.com    password: password')
        print('\nJWT tokens (use as Authorization: Bearer <token> or paste into localStorage token):')
        print('  alice token:')
        print(f'    {t1}')
        print('  bob token:')
        print(f'    {t2}')
        print('\nDemo campaign invite code:', camp.get('invite_code'))

    # Debug: print registered routes to help diagnose method/route mismatches
    try:
        rules = sorted([(r.rule, sorted(list(r.methods) if r.methods is not None else [])) for r in app.url_map.iter_rules()])
        print('Registered routes (rule -> methods):')
        for rule, methods in rules:
            print(f'  {rule} -> {methods}')
    except Exception:
        pass
    seed_demo_data()
    # In production prefer running under gunicorn with eventlet workers (see render.yaml).
    # The following fallback runs a development server when invoked directly.
    socketio.run(app, host='0.0.0.0', port=port, debug=debug)