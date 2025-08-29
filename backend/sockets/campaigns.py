from ..extensions import socketio
from flask_socketio import join_room, leave_room, emit


def campaign_room_name(cid):
    return f"campaign_{cid}"


@socketio.on('join')
def on_join(data):
    cid = data.get('campaign_id')
    if cid is None:
        return
    room = campaign_room_name(cid)
    join_room(room)


@socketio.on('leave')
def on_leave(data):
    cid = data.get('campaign_id')
    if cid is None:
        return
    room = campaign_room_name(cid)
    leave_room(room)


def emit_to_campaign(event, payload, campaign_id):
    room = campaign_room_name(campaign_id)
    socketio.emit(event, payload, to=room)
