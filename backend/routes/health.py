from flask import Blueprint, jsonify, request
import redis
from ..config import REDIS_URL, APP_ENV

bp = Blueprint('health', __name__)


@bp.route('/api/redis/ping', methods=['GET'])
def ping_redis():
    url = REDIS_URL
    if not url:
        # Return 200 with ok=false so monitoring doesn't treat missing optional
        # Redis as a hard failure for the service overall.
        return jsonify({'ok': False, 'message': 'REDIS_URL not configured'}), 200
    try:
        r = redis.from_url(url, socket_timeout=5)
        if r.ping():
            return jsonify({'ok': True}), 200
        return jsonify({'ok': False, 'message': 'ping failed'}), 200
    except Exception as e:
        return jsonify({'ok': False, 'message': str(e)}), 200


@bp.route('/api/health', methods=['GET'])
def health():
    health = {'ok': False, 'database': False, 'redis': False}
    try:
        from ..db import engine
        from sqlalchemy import text as _text
        conn = engine.connect()
        try:
            conn.execute(_text('SELECT 1'))
            health['database'] = True
        finally:
            conn.close()
    except Exception:
        health['database'] = False
    try:
        url = REDIS_URL
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

    # Always return 200 with a best-effort snapshot of database/redis availability.
    # This prevents external monitors from treating optional infra (like Redis)
    # as a hard service outage while keeping visibility into issues.
    health['ok'] = health['database']
    return jsonify(health), 200


@bp.route('/api/env', methods=['GET'])
def show_env():
    return jsonify({
        'app_env': APP_ENV,
        'allowed_origins': '',
        'database_url_set': bool(__import__('os').environ.get('DATABASE_URL')),
        'redis_url_set': bool(REDIS_URL)
    })
