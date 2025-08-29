from flask import Blueprint, jsonify, request
from ..services.campaigns import db_get_campaigns_for_user, db_create_campaign, resolve_campaign_id
from ..services.auth import get_user_from_auth

bp = Blueprint('campaigns', __name__)


@bp.route('/api/campaigns', methods=['GET'])
def list_campaigns():
    user = get_user_from_auth()
    if not user:
        return jsonify([])
    try:
        camps = db_get_campaigns_for_user(user['id'])
        return jsonify([{'id': c.id, 'uuid': getattr(c, 'uuid', None), 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code} for c in camps])
    except Exception:
        from ..config import APP_ENV
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        # Development fallback: return in-memory campaigns if DB unavailable
        member_ids = [m['campaign_id'] for m in [] if m.get('user_id') == user['id']]
        return jsonify([])


@bp.route('/api/campaigns', methods=['POST'])
def create_campaign():
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
    data = request.get_json() or {}
    name = data.get('name')
    if not name:
        return jsonify({'message': 'name required'}), 400
    try:
        c = db_create_campaign(name, user['id'])
        return jsonify({'id': c.id, 'uuid': getattr(c, 'uuid', None), 'name': c.name, 'owner': c.owner, 'invite_code': c.invite_code}), 201
    except Exception:
        return jsonify({'message': 'database unavailable'}), 503
