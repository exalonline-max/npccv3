from flask import Blueprint, current_app, send_from_directory, jsonify
import os

bp = Blueprint('spa', __name__)


@bp.route('/', defaults={'path': ''})
@bp.route('/<path:path>')
def spa(path):
    static_folder = current_app.static_folder
    if static_folder and os.path.exists(static_folder):
        if path and os.path.exists(os.path.join(static_folder, path)):
            return send_from_directory(static_folder, path)
        index = os.path.join(static_folder, 'index.html')
        if os.path.exists(index):
            return send_from_directory(static_folder, 'index.html')
    if path == '' or path == 'index.html':
        return jsonify({"message": "Frontend not built. Run `cd frontend && npm run build` and restart backend."}), 200
    return jsonify({"message": "Not found"}), 404
