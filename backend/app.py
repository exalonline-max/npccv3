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
    email = Column(String, unique=True, index=True)
    username = Column(String)
    password_hash = Column(String)
    character = relationship('Character', back_populates='user', uselist=False)


class Campaign(Base):
    __tablename__ = 'campaigns'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    owner = Column(Integer)
    invite_code = Column(String)
    characters = relationship('Character', back_populates='campaign')


class Membership(Base):
    __tablename__ = 'memberships'
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    role = Column(String)


class Character(Base):
    __tablename__ = 'characters'
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey('campaigns.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    name = Column(String)
    maxHp = Column(Integer)
    portrait = Column(Text)
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
except OperationalError:
    print('Warning: could not create DB tables at startup')

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
        u = User(email=email, username=username, password_hash=password_hash)
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
        ic = invite_code or f"INV-{int(datetime.datetime.utcnow().timestamp()) % 100000:05d}"
        c = Campaign(name=name, owner=owner_id, invite_code=ic)
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
        campaign_ids = [m.campaign_id for m in mids]
        if not campaign_ids:
            return []
        camps = s.query(Campaign).filter(Campaign.id.in_(campaign_ids)).all()
        return camps
    finally:
        s.close()

def db_create_membership(campaign_id, user_id, role='player'):
    s = SessionLocal()
    try:
        existing = s.query(Membership).filter(Membership.campaign_id == campaign_id, Membership.user_id == user_id).first()
        if existing:
            return existing
        m = Membership(campaign_id=campaign_id, user_id=user_id, role=role)
        s.add(m)
        s.commit()
        s.refresh(m)
        return m
    finally:
        s.close()

def db_get_memberships_for_user(uid):
    s = SessionLocal()
    try:
        return s.query(Membership).filter(Membership.user_id == uid).all()
    finally:
        s.close()

def db_create_message(campaign_id, author, text):
    s = SessionLocal()
    try:
        ts = datetime.datetime.utcnow().isoformat()
        m = Message(campaign_id=campaign_id, author=author, text=text, timestamp=ts)
        s.add(m)
        s.commit()
        s.refresh(m)
        return m
    finally:
        s.close()

def db_get_messages_for_campaign(cid, limit=100):
    s = SessionLocal()
    try:
        return s.query(Message).filter(Message.campaign_id == cid).order_by(Message.id).limit(limit).all()
    finally:
        s.close()


# In-memory fallback stores (kept for compatibility until full DB migration)
USERS = []
NEXT_USER_ID = 1

CAMPAIGNS = []
NEXT_CAMPAIGN_ID = 1

MEMBERSHIPS = []

MESSAGES = []
NEXT_MESSAGE_ID = 1

CHARACTERS = []
NEXT_CHARACTER_ID = 1


# JWT secret (override with env var in production)
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')


def make_token(user):
    # encode subject as string for compatibility with JWT libraries
    payload = {
        'sub': str(user['id']),
        'email': user.get('email'),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    # optional convenience claims
    if user.get('username'):
        payload['username'] = user.get('username')
    # include active campaign claims if present
    ac = user.get('active_campaign') or user.get('active-campaign') or user.get('activeCampaign')
    if ac is not None:
        payload['active-campaign'] = ac
        payload['activeCampaign'] = ac
    # include campaigns list if present
    if user.get('campaigns'):
        payload['campaigns'] = user.get('campaigns')
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def get_user_from_auth():
    # Try common locations for the token. Don't print tokens or secrets.
    token = None
    token_source = None
    # 1) Standard Authorization header (case-insensitive)
    try:
        auth_header = request.headers.get('Authorization') or request.environ.get('HTTP_AUTHORIZATION')
        if not auth_header:
            # some WSGI frontends/proxies may lowercase or move headers — scan headers defensively
            for k, v in request.headers.items():
                if k.lower() == 'authorization':
                    auth_header = v
                    break
        if auth_header:
            token_source = 'header'
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ', 1)[1]
            else:
                # accept raw token value as well
                token = auth_header
    except Exception:
        pass

    # 2) JSON body (some clients may send token in body)
    if not token and request.is_json:
        try:
            body = request.get_json(silent=True) or {}
            token_from_json = body.get('token') or body.get('access_token')
            if token_from_json:
                token = token_from_json
                token_source = 'json'
                print('get_user_from_auth: using token from JSON body (debug fallback)')
        except Exception:
            pass

    # 3) Query param
    if not token:
        token_q = request.args.get('token') or request.args.get('access_token')
        if token_q:
            token = token_q
            token_source = 'query'
            print('get_user_from_auth: using token from query param (debug fallback)')

    # 4) Cookie fallback (conservative)
    if not token:
        try:
            cookie_tok = request.cookies.get('token')
            if cookie_tok:
                token = cookie_tok
                token_source = 'cookie'
        except Exception:
            pass

    if not token:
        print('get_user_from_auth: no token found (checked header/body/query/cookie)')
        return None
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        uid = data.get('sub')
        # normalize uid type: try to coerce numeric string to int for comparisons
        try:
            if isinstance(uid, str) and uid.isdigit():
                uid = int(uid)
        except Exception:
            pass
        # Prefer DB-backed users when available. If a DB user exists with
        # this id, return a lightweight dict (mirror) so older endpoints
        # that expect a dict (not a SQLAlchemy object) continue to work.
        try:
            dbu = db_get_user_by_id(uid)
            found = bool(dbu)
            print(f"get_user_from_auth: token decoded uid={uid} type={type(uid).__name__} db_user_found={found} (token_source={token_source})")
            if dbu:
                return {'id': dbu.id, 'email': dbu.email, 'username': dbu.username}
        except Exception as e:
            print('get_user_from_auth: db lookup exception', str(e))
            pass
        # Fallback to in-memory USERS mirror
        return next((u for u in USERS if u['id'] == uid), None)
    except Exception as e:
        # Safe debug: log the decode error message but never print the token or secrets
        try:
            print('get_user_from_auth: token decode error', str(e), f'(token_source={token_source})')
        except Exception:
            pass
        return None


@app.route('/api/redis/ping', methods=['GET'])
def ping_redis():
    """Ping the configured Redis instance if present. Returns 200 with {ok: True}
    when reachable, or 503 when not configured or unreachable. Does not return
    any credentials or secrets."""
    url = os.environ.get('REDIS_URL') or os.environ.get('REDIS_URI')
    if not url:
        return jsonify({'ok': False, 'message': 'REDIS_URL not configured'}), 503
    try:
        r = redis.from_url(url, socket_timeout=5)
        if r.ping():
            return jsonify({'ok': True}), 200
        return jsonify({'ok': False, 'message': 'ping failed'}), 502
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 502


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"ok": True})


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
    # prefer DB-backed users if available
    existing = db_get_user_by_email(email)
    if existing:
        return jsonify({"message": "email already exists"}), 400
    # create in DB
    pwd_hash = generate_password_hash(password)
    try:
        new_user = db_create_user(email, username, pwd_hash)
        # add a simple in-memory mirror for older endpoints still using USERS
        mirror = {'id': new_user.id, 'email': new_user.email, 'username': new_user.username, 'password_hash': new_user.password_hash}
        # ensure NEXT_USER_ID stays ahead of DB ids for in-memory mirrors
        try:
            new_id = getattr(new_user, 'id', None)
            if new_id is not None:
                NEXT_USER_ID = max(NEXT_USER_ID, int(new_id) + 1)
        except Exception:
            pass
        USERS.append(mirror)
        token = make_token(mirror)
        return jsonify({"token": token}), 201
    except Exception:
        # fallback to in-memory creation if DB fails
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
        return jsonify({"token": token}), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    if not email or not password:
        return jsonify({"message": "email and password are required"}), 400
    # prefer DB lookup
    dbu = db_get_user_by_email(email)
    if dbu:
        if not check_password_hash(str(dbu.password_hash), password):
            return jsonify({"message": "invalid credentials"}), 401
        # create mirror token payload
        mirror = {'id': dbu.id, 'email': dbu.email, 'username': dbu.username}
        token = make_token(mirror)
        return jsonify({"token": token}), 200
    user = next((u for u in USERS if u['email'] == email), None)
    if not user or not check_password_hash(user['password_hash'], password):
        return jsonify({"message": "invalid credentials"}), 401
    token = make_token(user)
    return jsonify({"token": token}), 200


# ----- Campaigns & membership endpoints (dev in-memory) -----
@app.route('/api/campaigns', methods=['GET'])
def list_campaigns():
    user = get_user_from_auth()
    if not user:
        return jsonify([])
    # Prefer DB-backed campaigns when available
    try:
        camps = db_get_campaigns_for_user(user['id'])
        return jsonify([{'id': c.id, 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code} for c in camps])
    except Exception:
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
    # Try DB persistence first
    try:
        c = db_create_campaign(name, user['id'])
        db_create_membership(c.id, user['id'], role='owner')
        return jsonify({'id': c.id, 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code}), 201
    except Exception:
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
        return jsonify({'id': c.id, 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code})
    except Exception:
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
            return jsonify([{'id': c.id, 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code} for c in camps])
        finally:
            s.close()
    except Exception:
        return jsonify(CAMPAIGNS)


@app.route('/api/campaigns/<int:cid>/join', methods=['POST'])
def join_campaign_by_id(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
    try:
        c = db_get_campaign_by_id(cid)
        if not c:
            return jsonify({"message": "campaign not found"}), 404
        db_create_membership(c.id, user['id'], role='player')
        return jsonify({'id': c.id, 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code})
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
        return jsonify({'id': c.id, 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code})
    except Exception:
        camp = next((c for c in CAMPAIGNS if c.get('invite_code') == code or str(c.get('id')) == str(code)), None)
        if not camp:
            return jsonify({"message": "invalid code"}), 404
        if not any(m for m in MEMBERSHIPS if m['campaign_id'] == camp['id'] and m['user_id'] == user['id']):
            MEMBERSHIPS.append({'campaign_id': camp['id'], 'user_id': user['id'], 'role': 'player'})
        return jsonify(camp)


@app.route('/api/campaigns/<int:cid>/messages', methods=['GET'])
def list_campaign_messages(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify([]), 401
    # simple membership check
    try:
        # check membership via DB
        mids = db_get_memberships_for_user(user['id'])
        if not any(m.campaign_id == cid for m in mids):
            return jsonify({"message": "forbidden"}), 403
        msgs = db_get_messages_for_campaign(cid)
        return jsonify([{'id': m.id, 'campaign_id': m.campaign_id, 'author': m.author, 'text': m.text, 'timestamp': m.timestamp} for m in msgs])
    except Exception:
        if not any(m for m in MEMBERSHIPS if m['campaign_id'] == cid and m['user_id'] == user['id']):
            return jsonify({"message": "forbidden"}), 403
        msgs = [m for m in MESSAGES if m['campaign_id'] == cid]
        return jsonify(msgs)


@app.route('/api/campaigns/<int:cid>/messages', methods=['POST'])
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
        if not any(m.campaign_id == cid for m in mids):
            return jsonify({"message": "forbidden"}), 403
        m = db_create_message(cid, user['username'], body)
        msg = {'id': m.id, 'campaign_id': m.campaign_id, 'author': m.author, 'text': m.text, 'timestamp': m.timestamp}
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


@app.route('/api/campaigns/<int:cid>/characters', methods=['GET'])
def list_characters(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify([]), 401
    # membership check omitted for brevity in demo
    chars = [c for c in CHARACTERS if c.get('campaign_id') == cid]
    return jsonify(chars)


@app.route('/api/campaigns/<int:cid>/characters', methods=['POST'])
def create_character(cid):
    global NEXT_CHARACTER_ID
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
    # simple membership check
    if not any(m for m in MEMBERSHIPS if m['campaign_id'] == cid and m['user_id'] == user['id']):
        return jsonify({"message": "forbidden"}), 403
    data = request.get_json() or {}
    name = data.get('name') or ''
    maxHp = data.get('maxHp') or 0
    portrait = data.get('portrait') or ''
    try:
        maxHp = int(maxHp)
    except Exception:
        maxHp = 0
    # Try DB persistence first
    try:
        s = SessionLocal()
        try:
            c = Character(campaign_id=cid, user_id=user['id'], name=name, maxHp=maxHp, portrait=portrait)
            s.add(c)
            s.commit()
            s.refresh(c)
            res = {'id': c.id, 'campaign_id': c.campaign_id, 'user_id': c.user_id, 'name': c.name, 'maxHp': c.maxHp, 'portrait': c.portrait}
            # mirror to in-memory
            CHARACTERS.append(res)
            # keep in-memory id counters ahead of DB ids
            try:
                cid_val = getattr(c, 'id', None)
                if cid_val is not None:
                    NEXT_CHARACTER_ID = max(NEXT_CHARACTER_ID, int(cid_val) + 1)
            except Exception:
                pass
            return jsonify(res), 201
        finally:
            s.close()
    except Exception:
        # DB failed - fallback to in-memory
        char = {
            'id': NEXT_CHARACTER_ID,
            'campaign_id': cid,
            'user_id': user['id'],
            'name': name,
            'maxHp': maxHp,
            'portrait': portrait
        }
        NEXT_CHARACTER_ID += 1
        CHARACTERS.append(char)
        return jsonify(char), 201



@app.route('/api/users/me/active-campaign', methods=['PUT'])
def set_active_campaign():
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
    data = request.get_json() or {}
    cid = data.get('campaign')
    # accept campaign id or name
    camp = None
    if isinstance(cid, int) or (isinstance(cid, str) and cid.isdigit()):
        # try DB first
        try:
            db_c = db_get_campaign_by_id(int(cid))
            if db_c:
                camp = {'id': db_c.id, 'name': db_c.name, 'owner': db_c.owner, 'invite_code': db_c.invite_code}
        except Exception:
            camp = next((c for c in CAMPAIGNS if c['id'] == int(cid)), None)
    else:
        try:
            db_c = db_get_campaign_by_name(cid) if cid is not None else None
            if db_c:
                camp = {'id': db_c.id, 'name': db_c.name, 'owner': db_c.owner, 'invite_code': db_c.invite_code}
        except Exception:
            camp = next((c for c in CAMPAIGNS if c['name'] == cid), None)
    if not camp and cid is not None:
        return jsonify({"message": "campaign not found"}), 404
    # If DB-backed user exists, return a refreshed token with claim; do not attempt to modify DB user object here
    try:
        dbu = db_get_user_by_id(user['id'])
    except Exception:
        dbu = None
    if dbu:
        mirror = {'id': dbu.id, 'email': dbu.email, 'username': dbu.username}
        if camp:
            mirror['active_campaign'] = camp['name']
        token = make_token(mirror)
        return jsonify({'token': token}), 200
    # in-memory user mirror
    u = next((u for u in USERS if u['id'] == user['id']), None)
    if u is not None:
        u['active_campaign'] = camp['id'] if camp else None
    mirror = {'id': user['id'], 'email': user.get('email'), 'username': user.get('username')}
    if camp:
        mirror['active_campaign'] = camp['name']
    token = make_token(mirror)
    return jsonify({'token': token}), 200


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
                return jsonify({'id': ch.id, 'campaign_id': ch.campaign_id, 'user_id': ch.user_id, 'name': ch.name, 'maxHp': ch.maxHp, 'portrait': ch.portrait}), 200
        finally:
            s.close()
    except Exception:
        pass
    # Fallback to in-memory mirror on user or global CHARACTERS
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
                existing.name = name or existing.name
                existing.maxHp = maxHp
                existing.portrait = portrait or existing.portrait
                s.add(existing)
                s.commit()
                s.refresh(existing)
                ch = existing
            else:
                campaign_id = data.get('campaign_id')
                ch = Character(campaign_id=campaign_id, user_id=user['id'], name=name or '', maxHp=maxHp, portrait=portrait or '')
                s.add(ch)
                s.commit()
                s.refresh(ch)
            res = {'id': ch.id, 'campaign_id': ch.campaign_id, 'user_id': ch.user_id, 'name': ch.name, 'maxHp': ch.maxHp, 'portrait': ch.portrait}
            # mirror into in-memory list for demo compatibility
            existing_mem = next((c for c in CHARACTERS if c.get('id') == res['id']), None)
            if not existing_mem:
                CHARACTERS.append(res)
            return jsonify(res), 200
        finally:
            s.close()
    except Exception:
        # fallback to in-memory
        existing = next((c for c in CHARACTERS if c.get('user_id') == user['id']), None)
        if existing:
            existing['name'] = name or existing.get('name')
            existing['maxHp'] = maxHp
            existing['portrait'] = portrait or existing.get('portrait')
            return jsonify(existing), 200
        global NEXT_CHARACTER_ID
        ch = {'id': NEXT_CHARACTER_ID, 'campaign_id': data.get('campaign_id'), 'user_id': user['id'], 'name': name or '', 'maxHp': maxHp, 'portrait': portrait or ''}
        NEXT_CHARACTER_ID += 1
        CHARACTERS.append(ch)
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

    seed_demo_data()
    # In production prefer running under gunicorn with eventlet workers (see render.yaml).
    # The following fallback runs a development server when invoked directly.
    socketio.run(app, host='0.0.0.0', port=port, debug=debug)