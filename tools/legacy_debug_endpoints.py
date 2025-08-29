"""
Legacy debug endpoints moved out of the runtime for MVP.
Use these helpers locally or in development when needed.
"""
from flask import Blueprint, jsonify, request
from backend.config import APP_ENV
from backend.services.auth import JWT_SECRET
import hashlib
import jwt

bp = Blueprint('legacy_debug', __name__)


@bp.route('/api/_debug/inspect', methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])
def debug_inspect():
    inspect_path = request.args.get('path') or request.path
    inspect_method = (request.args.get('method') or request.method).upper()
    matches = []
    try:
        from flask import current_app
        for r in current_app.url_map.iter_rules():
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


@bp.route('/api/_debug/decode-token', methods=['GET'])
def debug_decode_token():
    enabled = (request.environ.get('DEBUG_AUTH', '').lower() == 'true') or (APP_ENV != 'production')
    if not enabled:
        return jsonify({'message': 'not found'}), 404
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
    error = None
    if token:
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        except Exception as e:
            error = str(e)
    else:
        error = 'no token provided'
    return jsonify({'ok': error is None, 'token_payload': payload, 'error': error, 'headers_present': bool(request.headers)}), 200 if error is None else 400


@bp.route('/api/_debug/secret-hash', methods=['GET'])
def debug_secret_hash():
    enabled = (request.environ.get('DEBUG_SECRET_HASH', '').lower() == 'true') or (APP_ENV != 'production')
    if not enabled:
        return jsonify({'message': 'not found'}), 404
    try:
        secret = JWT_SECRET or ''
        h = hashlib.sha256(secret.encode('utf-8')).hexdigest()
    except Exception:
        h = None
    return jsonify({'ok': True, 'secret_hash': h}), 200


@bp.route('/api/debug/token', methods=['GET'])
def debug_token():
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
