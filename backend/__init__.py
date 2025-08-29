from flask import Flask
from .config import APP_ENV, ALLOWED_ORIGINS
from .extensions import cors, socketio
from .config import determine_origins


def create_app(static_folder=None):
    app = Flask(__name__, static_folder=static_folder)
    # Configure CORS based on env
    origins = determine_origins(APP_ENV, ALLOWED_ORIGINS)
    if origins:
        cors.init_app(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=False, expose_headers=["Content-Type"])
    else:
        cors.init_app(app, resources={r"/api/*": {"origins": []}}, supports_credentials=False, expose_headers=["Content-Type"])

    # Register blueprints
    from .routes.health import bp as health_bp
    from .routes.debug import bp as debug_bp
    from .routes.npcs import bp as npcs_bp
    from .routes.auth import bp as auth_bp
    from .routes.campaigns import bp as campaigns_bp
    from .routes.messages import bp as messages_bp
    from .routes.characters import bp as characters_bp
    from .routes.spa import bp as spa_bp

    app.register_blueprint(health_bp)
    app.register_blueprint(debug_bp)
    app.register_blueprint(npcs_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(campaigns_bp)
    app.register_blueprint(messages_bp)
    app.register_blueprint(characters_bp)
    app.register_blueprint(spa_bp)

    return app
