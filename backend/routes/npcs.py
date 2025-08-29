from flask import Blueprint, jsonify, request

bp = Blueprint('npcs', __name__)

NPCS = []
NEXT_ID = 1


@bp.route('/api/npcs', methods=['GET'])
def list_npcs():
    return jsonify(NPCS)


@bp.route('/api/npcs', methods=['POST'])
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
