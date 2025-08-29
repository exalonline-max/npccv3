from flask_cors import CORS
from flask_socketio import SocketIO

# Create unbound extension objects to be initialized by the app factory
cors = CORS()
socketio = SocketIO(cors_allowed_origins="*")
