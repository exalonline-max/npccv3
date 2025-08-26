from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, join_room, leave_room, emit
import os
import datetime
import jwt
import redis  # Added import for Redis support
from werkzeug.security import generate_password_hash, check_password_hash

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

# ----- In-memory stores (demo only) -----
NPCS = []
NEXT_ID = 1

USERS = []
NEXT_USER_ID = 1

# Campaigns / messages / characters (in-memory demo stores)
CAMPAIGNS = []
NEXT_CAMPAIGN_ID = 1

MEMBERSHIPS = []  # { campaign_id, user_id, role }

MESSAGES = []
NEXT_MESSAGE_ID = 1

CHARACTERS = []
NEXT_CHARACTER_ID = 1

# JWT secret (override with env var in production)
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')


def make_token(user):
    payload = {
        'sub': user['id'],
        'email': user['email'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def get_user_from_auth():
    auth = request.headers.get('Authorization') or ''
    if not auth.startswith('Bearer '):
        return None
    token = auth.split(' ', 1)[1]
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        uid = data.get('sub')
        return next((u for u in USERS if u['id'] == uid), None)
    except Exception:
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
    # return campaigns where user is a member
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
    camp = next((c for c in CAMPAIGNS if c.get('name') == test_name), None)
    if not camp:
        # create a predictable invite code for the test campaign
        camp = { 'id': NEXT_CAMPAIGN_ID, 'name': test_name, 'owner': user['id'], 'invite_code': f"TEST-{NEXT_CAMPAIGN_ID:04d}" }
        NEXT_CAMPAIGN_ID += 1
        CAMPAIGNS.append(camp)

    # add membership if not exists
    if not any(m for m in MEMBERSHIPS if m['campaign_id'] == camp['id'] and m['user_id'] == user['id']):
        MEMBERSHIPS.append({'campaign_id': camp['id'], 'user_id': user['id'], 'role': 'player'})

    # Return the campaign object (frontend will select it)
    return jsonify(camp)


@app.route('/api/campaigns/public', methods=['GET'])
def public_campaigns():
    # Return all campaigns (public listing). For production, add pagination/filters.
    return jsonify(CAMPAIGNS)


@app.route('/api/campaigns/<int:cid>/join', methods=['POST'])
def join_campaign_by_id(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
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
    camp = next((c for c in CAMPAIGNS if c.get('invite_code') == code or str(c.get('id')) == str(code)), None)
    if not camp:
        return jsonify({"message": "invalid code"}), 404
    # add membership if not exists
    if not any(m for m in MEMBERSHIPS if m['campaign_id'] == camp['id'] and m['user_id'] == user['id']):
        MEMBERSHIPS.append({'campaign_id': camp['id'], 'user_id': user['id'], 'role': 'player'})
    return jsonify(camp)


@app.route('/api/campaigns/<int:cid>/messages', methods=['GET'])
def list_campaign_messages(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify([]), 401
    # simple membership check
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
    if not any(m for m in MEMBERSHIPS if m['campaign_id'] == cid and m['user_id'] == user['id']):
        return jsonify({"message": "forbidden"}), 403
    data = request.get_json() or {}
    body = data.get('text') or data.get('body') or data.get('message') or ''
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
        camp = next((c for c in CAMPAIGNS if c['id'] == int(cid)), None)
    else:
        camp = next((c for c in CAMPAIGNS if c['name'] == cid), None)
    if not camp and cid is not None:
        return jsonify({"message": "campaign not found"}), 404
    # store on user object for demo
    user['active_campaign'] = camp['id'] if camp else None
    # return a refreshed token including active-campaign claim
    new_payload = {
        'sub': user['id'],
        'email': user['email'],
        'activeCampaign': CAMPAIGNS and (camp['name'] if camp else None),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    token = jwt.encode(new_payload, JWT_SECRET, algorithm='HS256')
    return jsonify({'token': token})


@app.route('/api/users/me/character', methods=['GET'])
def get_my_character():
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
    # return stored character or 404
    ch = user.get('character')
    if not ch:
        return jsonify({}), 200
    return jsonify(ch), 200


@app.route('/api/users/me/character', methods=['PUT'])
def set_my_character():
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
    data = request.get_json() or {}
    # Only allow simple fields for now
    name = data.get('name')
    maxHp = data.get('maxHp')
    # validate
    try:
        maxHp = int(maxHp) if maxHp is not None else None
    except Exception:
        return jsonify({'message': 'maxHp must be a number'}), 400
    char = {'name': name or '', 'maxHp': maxHp if maxHp is not None else 0}
    user['character'] = char
    return jsonify(char), 200


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