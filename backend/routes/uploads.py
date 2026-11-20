"""Image uploads for news posts.

Only users who may publish news can upload. Uploaded images are served
publicly (published news is public, so its images must be too).
"""

import os
import uuid

from flask import Blueprint, current_app, jsonify, request, send_from_directory

from backend.security import permission_required

bp = Blueprint("uploads", __name__, url_prefix="/api/uploads")

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


def _upload_dir():
    # Flask's instance folder: keeps user files out of the source tree and
    # out of version control (.gitignore excludes instance/).
    dirpath = os.path.join(current_app.instance_path, "uploads")
    os.makedirs(dirpath, exist_ok=True)
    return dirpath


@bp.post("")
@permission_required("publish_news")
def upload_image():
    if "file" not in request.files:
        return jsonify(error={"code": "validation_error", "message": "No file provided."}), 422
    file = request.files["file"]
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        return (
            jsonify(
                error={
                    "code": "validation_error",
                    "message": "Images must be JPG, PNG, GIF, or WebP.",
                }
            ),
            422,
        )
    # Read the whole file first so the size check is real, not just the
    # Content-Length header (which clients can fake).
    data = file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        return (
            jsonify(error={"code": "validation_error", "message": "Images must be 5 MB or smaller."}),
            422,
        )
    stored_name = f"{uuid.uuid4().hex}{ext}"
    with open(os.path.join(_upload_dir(), stored_name), "wb") as out:
        out.write(data)
    return jsonify(url=f"/api/uploads/{stored_name}", filename=stored_name), 201


@bp.get("/<stored_name>")
def get_image(stored_name):
    # Only serve files we generated: hex name + allowed extension.
    base, ext = os.path.splitext(stored_name)
    if len(base) != 32 or not all(c in "0123456789abcdef" for c in base) or ext.lower() not in ALLOWED_EXTENSIONS:
        return jsonify(error={"code": "not_found", "message": "Image not found."}), 404
    return send_from_directory(_upload_dir(), stored_name)
