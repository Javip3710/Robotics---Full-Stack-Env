# FRC Robotics Team Portal — Flask entry point.
#
# Usage:
#   python application.py              # run the API + (if built) frontend on :5000
#   python application.py seed        # reset DB and load demo fixtures (DEV ONLY)
#   python application.py create-user # interactive helper to create a real first user
#
# Environment variables (see .env.example):
#   SECRET_KEY            signing key for auth tokens (required in production)
#   DATABASE_URL          SQLAlchemy URL (defaults to local SQLite)
#   FLASK_CORS_ORIGINS    comma-separated allowed origins for API CORS
#   TOKEN_TTL_SECONDS     auth token lifetime

import os
import sys

from backend import create_app

from livereload import Server

app = create_app()

# Serve the built frontend (frontend/dist) when it exists, with SPA fallback,
# so a single `python application.py` runs the whole app in development.
_frontend_dist = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend", "dist")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path.startswith("api/"):
        return {"error": {"code": "not_found", "message": "Resource not found."}}, 404
    if os.path.exists(_frontend_dist):
        from flask import send_from_directory

        full = os.path.join(_frontend_dist, path)
        if path and os.path.isfile(full):
            return send_from_directory(_frontend_dist, path)
        return send_from_directory(_frontend_dist, "index.html")
    return (
        "<h1>FRC Team Portal API</h1>"
        "<p>The API is running. Build the frontend (see README) or use /api endpoints.</p>"
    )

def delete_all():
    with app.app_context():
        from backend.seed import demo

        demo()

def seed():
    """Load clearly-labeled demo fixtures into a fresh database. DEV ONLY."""
    with app.app_context():
        from backend.seed import seed_demo

        seed_demo()


def create_user():
    """Create a real first user (bypasses demo fixtures)."""
    import getpass

    from backend import db
    from backend.models import User
    from backend.security import hash_password

    with app.app_context():
        email = input("Email: ").strip().lower()
        name = input("Name: ").strip()
        role = input("Role (mentor/captain/lead/member) [mentor]: ").strip() or "mentor"
        if role not in ("mentor", "captain", "lead", "member"):
            print("Invalid role.")
            sys.exit(1)
        password = getpass.getpass("Password (min 8 chars): ")
        if len(password) < 8:
            print("Password too short.")
            sys.exit(1)
        if User.query.filter_by(email=email).first():
            print("User already exists.")
            sys.exit(1)
        db.session.add(
            User(
                email=email,
                name=name,
                password_hash=hash_password(password),
                role=role,
                status="approved",
            )
        )
        db.session.commit()
        print(f"Created approved user {email} ({role}).")


if __name__ == "__main__":
    if len(sys.argv) > 1:
        if sys.argv[1] == "seed":
            if input("This resets the database and loads DEMO fixtures. Continue? [y/N] ")[:1].lower() != "y":
                sys.exit(0)
            seed()
        elif sys.argv[1] == "create-user":
            create_user()
        elif sys.argv[1] == "delete-all":
            delete_all()
        else:
            print("Unknown command. Use: seed | create-user")
        sys.exit(0)

    app.config["TEMPLATES_AUTO_RELOAD"] = True
    server = Server(app.wsgi_app)
    server.watch("pages/")

    
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=True)
    