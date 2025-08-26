from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import datetime
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

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
    # Restrict production to configured origins
    origins = [o.strip() for o in ALLOWED_ORIGINS.split(",") if o.strip()]
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

# JWT secret (override with env var in production)
JWT_SECRET = os.environ.get('JWT_SECRET', 'dev-secret')


def make_token(user):
    payload = {
        'sub': user['id'],
        'email': user['email'],
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"ok": True})


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


if __name__ == '__main__':
    # Port defaults to 5001 to match your dev setup
    port = int(os.environ.get('PORT', 5001))
    debug = os.environ.get('DEBUG', 'true' if APP_ENV == 'development' else 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)