from flask import Blueprint, jsonify, request
from ..services.messages import db_get_messages_for_campaign, db_create_message
from ..services.auth import get_user_from_auth

bp = Blueprint('messages', __name__)


@bp.route('/api/campaigns/<cid>/messages', methods=['GET'])
def list_messages(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
    try:
        mid = int(cid) if cid.isdigit() else cid
    except Exception:
        mid = cid
    try:
        msgs = db_get_messages_for_campaign(mid)
        return jsonify([{'id': m.id, 'campaign_id': m.campaign_id, 'author': m.author, 'text': m.text, 'timestamp': m.timestamp} for m in msgs])
    except Exception:
        from ..config import APP_ENV
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        return jsonify([])


@bp.route('/api/campaigns/<cid>/messages', methods=['POST'])
def post_message(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
    data = request.get_json() or {}
    text = data.get('text')
    if not text:
        return jsonify({'message': 'text required'}), 400
    try:
        mid = int(cid) if cid.isdigit() else cid
    except Exception:
        mid = cid
    try:
        m = db_create_message(mid, user.get('username') or user.get('email'), text)
        return jsonify({'id': m.id, 'campaign_id': m.campaign_id, 'author': m.author, 'text': m.text, 'timestamp': m.timestamp}), 201
    except Exception:
        return jsonify({'message': 'database unavailable'}), 503
