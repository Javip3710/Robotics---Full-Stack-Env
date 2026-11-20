"""FRC Robotics Team Portal — Flask application factory."""

import os

from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def _is_api_request():
    from flask import request

    return request.path.startswith("/api/")


def create_app():
    app = Flask(__name__, static_folder=None)

    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "Robotics-FullStackTesting")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "sqlite:///frc_portal.db"
    )
    app.config["TOKEN_TTL_SECONDS"] = int(
        os.environ.get("TOKEN_TTL_SECONDS", str(60 * 60 * 12))
    )

    db.init_app(app)

    cors_origins = os.environ.get("FLASK_CORS_ORIGINS")
    if cors_origins:
        CORS(
            app,
            resources={r"/api/*": {"origins": [o.strip() for o in cors_origins.split(",")]}},
        )


    from backend.routes import auth, documents, events, inventory, members, news, scouting, uploads, TeamOverview, GettingInvolved

    for module in (auth, news, documents, events, members, scouting, inventory, uploads, TeamOverview, GettingInvolved):
        app.register_blueprint(module.bp)

    @app.errorhandler(404)
    def not_found(e):
        if _is_api_request():
            return jsonify(error={"code": "not_found", "message": "Resource not found."}), 404
        return e

    @app.errorhandler(405)
    def method_not_allowed(e):
        if _is_api_request():
            return (
                jsonify(error={"code": "method_not_allowed", "message": "Method not allowed."}),
                405,
            )
        return e

    @app.errorhandler(500)
    def server_error(e):
        if _is_api_request():
            return (
                jsonify(error={"code": "server_error", "message": "Internal server error."}),
                500,
            )
        return e

    with app.app_context():
        db.create_all()

    return app
