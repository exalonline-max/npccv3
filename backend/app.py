from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import datetime
import jwt
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

# In-memory NPC store
NPCS = []
NEXT_ID = 1

# In-memory user store (very small demo; replace with DB in production)
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
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5001)), debug=True)
