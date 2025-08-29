from flask import Blueprint, jsonify, request
import json

from ..services.auth import get_user_from_auth, make_token
from ..services.campaigns import db_get_campaign_by_id, db_get_campaign_by_name
from ..db import SessionLocal
from ..models import User, Character
from ..config import APP_ENV

bp = Blueprint('users', __name__)


@bp.route('/api/users/me/active-campaign', methods=['PUT'])
def set_active_campaign():
    user = get_user_from_auth()
    if not user:
        return jsonify({"message": "unauthorized"}), 401
    data = request.get_json() or {}
    cid = data.get('campaign')
    camp = None
    db_error = False

    # look up campaign by id or name
    if isinstance(cid, int) or (isinstance(cid, str) and cid.isdigit()):
        try:
            db_c = db_get_campaign_by_id(int(cid))
            if db_c:
                camp = {'id': db_c.id, 'name': db_c.name, 'owner': db_c.owner, 'invite_code': db_c.invite_code}
        except Exception:
            db_error = True
    else:
        try:
            db_c = db_get_campaign_by_name(cid) if cid is not None else None
            if db_c:
                camp = {'id': db_c.id, 'name': db_c.name, 'owner': db_c.owner, 'invite_code': db_c.invite_code}
        except Exception:
            db_error = True

    if not camp and cid is not None:
        return jsonify({"message": "campaign not found"}), 404

    # If we have a DB user, return refreshed token with claim
    try:
        s = SessionLocal()
        try:
            dbu = s.query(User).filter(User.id == user['id']).first()
        finally:
            s.close()
    except Exception:
        dbu = None

    if dbu:
        mirror = {'id': dbu.id, 'email': dbu.email, 'username': dbu.username}
        if camp:
            mirror['active_campaign'] = camp['name']
        token = make_token(mirror)
        return jsonify({'token': token, 'user': mirror}), 200

    if db_error and APP_ENV != 'development':
        return jsonify({'message': 'database unavailable'}), 503

    # Development fallback: return token with updated claim
    mirror = {'id': user['id'], 'email': user.get('email'), 'username': user.get('username')}
    if camp:
        mirror['active_campaign'] = camp['name']
    token = make_token(mirror)
    return jsonify({'token': token, 'user': mirror}), 200


@bp.route('/api/users/me/character', methods=['GET'])
def get_my_character():
    user = get_user_from_auth()
    if not user:
        return jsonify({'message': 'unauthorized'}), 401
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
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503

    return jsonify({}), 404


@bp.route('/api/users/me/character', methods=['PUT'])
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
    try:
        maxHp = int(maxHp) if maxHp is not None else 0
    except Exception:
        return jsonify({'message': 'maxHp must be a number'}), 400
    try:
        s = SessionLocal()
        try:
            existing = s.query(Character).filter(Character.user_id == user['id']).first()
            if existing:
                setattr(existing, 'name', name or getattr(existing, 'name'))
                setattr(existing, 'maxHp', maxHp)
                setattr(existing, 'portrait', portrait or getattr(existing, 'portrait'))
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
            try:
                blob_text = getattr(ch, 'data', None)
                blob = json.loads(blob_text) if blob_text else {}
            except Exception:
                blob = {}
            if isinstance(blob, dict):
                res.update(blob)
            return jsonify(res), 200
        finally:
            s.close()
    except Exception:
        if APP_ENV != 'development':
            return jsonify({'message': 'database unavailable'}), 503
        return jsonify({'message': 'database unavailable'}), 503