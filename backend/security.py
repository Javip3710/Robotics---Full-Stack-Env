"""Token issuing/verification (compact HS256 JWT) and auth request helpers.

No third-party JWT library is required: tokens are HMAC-SHA256 signed with the
app SECRET_KEY. Passwords are hashed with Werkzeug's PBKDF2 (never stored in
plain text, never logged).
"""

import base64
import hashlib
import hmac
import json
import time
from functools import wraps

from flask import current_app, g, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from backend.models import User

__all__ = [
    "hash_password",
    "verify_password",
    "issue_token",
    "verify_token",
    "load_current_user",
    "login_required",
    "active_required",
    "permission_required",
]


def hash_password(password: str) -> str:
    return generate_password_hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return check_password_hash(password_hash, password)


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def issue_token(user_id: int, ttl_seconds: int) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    now = int(time.time())
    payload = {"sub": str(user_id), "iat": now, "exp": now + ttl_seconds}
    signing_input = _b64(json.dumps(header, separators=(",", ":")).encode()) + "." + _b64(
        json.dumps(payload, separators=(",", ":")).encode()
    )
    signature = _b64(
        hmac.new(
            current_app.config["SECRET_KEY"].encode(), signing_input.encode(), hashlib.sha256
        ).digest()
    )
    return f"{signing_input}.{signature}"


def verify_token(token: str):
    """Return the token payload dict, or None if invalid/expired."""
    try:
        signing_input, signature = token.rsplit(".", 1)
        expected = _b64(
            hmac.new(
                current_app.config["SECRET_KEY"].encode(),
                signing_input.encode(),
                hashlib.sha256,
            ).digest()
        )
        if not hmac.compare_digest(signature, expected):
            return None
        header = json.loads(_unb64(signing_input.split(".")[0]))
        payload = json.loads(_unb64(signing_input.split(".")[1]))
        if header.get("alg") != "HS256":
            return None
        if int(payload.get("exp", 0)) < time.time():
            return None
        return payload
    except (ValueError, KeyError, json.JSONDecodeError):
        return None


def load_current_user():
    """Resolve the requesting user from the Authorization header, or None."""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    payload = verify_token(header[7:].strip())
    if payload is None:
        return None
    try:
        user = db_get_user(int(payload["sub"]))
    except (KeyError, ValueError):
        return None
    return user


def db_get_user(user_id: int):
    from backend import db

    return db.session.get(User, user_id)


def _unauthenticated():
    return (
        jsonify(error={"code": "unauthenticated", "message": "Authentication required."}),
        401,
    )


def login_required(f):
    """Requires a valid token and an account that is not deleted."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        user = load_current_user()
        if user is None:
            return _unauthenticated()
        g.current_user = user
        return f(*args, **kwargs)

    return wrapper


def active_required(f):
    """Requires an approved member (pending/suspended get 403)."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        user = load_current_user()
        if user is None:
            return _unauthenticated()
        if user.status != "approved":
            return (
                jsonify(
                    error={
                        "code": "forbidden",
                        "message": f"Your membership is {user.status}. Approved membership is required.",
                    }
                ),
                403,
            )
        g.current_user = user
        return f(*args, **kwargs)

    return wrapper


def permission_required(action: str):
    """Requires an approved member whose role is allowed for `action` (see permissions.py)."""

    from backend.permissions import can

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            user = load_current_user()
            if user is None:
                return _unauthenticated()
            if user.status != "approved" or not can(user, action):
                return (
                    jsonify(
                        error={
                            "code": "forbidden",
                            "message": "You do not have permission to perform this action.",
                        }
                    ),
                    403,
                )
            g.current_user = user
            return f(*args, **kwargs)

        return wrapper

    return decorator
