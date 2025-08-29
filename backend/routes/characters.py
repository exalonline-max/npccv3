from flask import Blueprint, jsonify, request
from ..services.characters import db_get_characters_for_campaign, db_create_character, pack_character_data, unpack_character_data
from ..services.auth import get_user_from_auth

bp = Blueprint('characters', __name__)


@bp.route('/api/campaigns/<cid>/characters', methods=['GET'])
def list_characters(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
    try:
        mid = int(cid) if cid.isdigit() else cid
    except Exception:
        mid = cid
    try:
        chars = db_get_characters_for_campaign(mid)
        return jsonify([{'id': c.id, 'name': c.name, 'user_id': c.user_id, 'data': unpack_character_data(c.data)} for c in chars])
    except Exception:
        from ..config import APP_ENV
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        return jsonify([])


@bp.route('/api/campaigns/<cid>/characters', methods=['POST'])
def create_character(cid):
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
    data = request.get_json() or {}
    name = data.get('name')
    blob = data.get('data') or {}
    if not name:
        return jsonify({'message': 'name required'}), 400
    try:
        mid = int(cid) if cid.isdigit() else cid
    except Exception:
        mid = cid
    try:
        c = db_create_character(mid, user.get('id'), name, pack_character_data(blob))
        return jsonify({'id': c.id, 'name': c.name, 'user_id': c.user_id, 'data': unpack_character_data(c.data)}), 201
    except Exception:
        return jsonify({'message': 'database unavailable'}), 503
