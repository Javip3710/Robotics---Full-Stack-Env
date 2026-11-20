"""Authentication endpoints: register, login, current user."""

import re

from flask import Blueprint, current_app, jsonify, request

from backend import db
from backend.models import User
from backend.security import issue_token, load_current_user, login_required, hash_password

bp = Blueprint("auth", __name__, url_prefix="/api/auth")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _user_payload(user):
    return {"token": issue_token(user.id, current_app.config["TOKEN_TTL_SECONDS"]), "user": user.to_dict()}


@bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    errors = {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    if len(name) < 2:
        errors["name"] = "Name is required."
    if not EMAIL_RE.match(email):
        errors["email"] = "A valid email address is required."
    if len(password) < 8:
        errors["password"] = "Password must be at least 8 characters."
    if errors:
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": errors}), 422
    if User.query.filter_by(email=email).first():
        return (
            jsonify(
                error={
                    "code": "validation_error",
                    "message": "Invalid input.",
                    "details": {"email": "An account with this email already exists."},
                }
            ),
            422,
        )
    # New accounts are pending and must be approved before accessing anything.
    user = User(name=name, email=email, password_hash=hash_password(password), role="member", status="pending")
    db.session.add(user)
    db.session.commit()
    return jsonify(user.to_dict()), 201


@bp.post("/login")
def login():
    from backend.security import verify_password

    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = User.query.filter_by(email=email).first()
    if user is None or not verify_password(password, user.password_hash):
        # Same error for unknown email and wrong password (no account enumeration).
        return jsonify(error={"code": "invalid_credentials", "message": "Invalid email or password."}), 401
    return jsonify(_user_payload(user))


@bp.get("/me")
def me():
    """Current user, or an explicit anonymous response (used by the frontend)."""
    user = load_current_user()
    if user is None:
        return jsonify(user=None), 200
    return jsonify(user=user.to_dict()), 200


@bp.post("/logout")
@login_required
def logout():
    # Tokens are stateless and expire; the client discards the token.
    return jsonify(ok=True)
