"""Documentation endpoints with public/internal visibility."""

import re

from flask import Blueprint, g, jsonify, request

from backend import db
from backend.models import Document
from backend.security import active_required, load_current_user, permission_required

bp = Blueprint("documents", __name__, url_prefix="/api/documents")

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _may_see_internal():
    user = load_current_user()
    return user is not None and user.status == "approved"


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    base = slug or "document"
    candidate = base
    n = 1
    while Document.query.filter_by(slug=candidate).first() is not None:
        n += 1
        candidate = f"{base}-{n}"
    return candidate


@bp.get("")
def list_documents():
    """Public listing shows public documents only; approved members also see internal ones.

    Query params: ?category=, ?search= (title/category substring), ?visibility=
    (approved members only).
    """
    query = Document.query
    if not _may_see_internal():
        query = query.filter_by(visibility="public")
    else:
        visibility = request.args.get("visibility")
        if visibility in ("public", "internal"):
            query = query.filter_by(visibility=visibility)
    category = request.args.get("category")
    if category:
        query = query.filter(Document.category.ilike(f"%{category}%"))
    search = request.args.get("search")
    if search:
        like = f"%{search}%"
        query = query.filter((Document.title.ilike(like)) | (Document.body.ilike(like)))
    docs = query.order_by(Document.category, Document.title).all()
    return jsonify(items=[d.to_dict() for d in docs], total=len(docs))


@bp.get("/categories")
def list_categories():
    query = Document.query
    if not _may_see_internal():
        query = query.filter_by(visibility="public")
    categories = sorted({d.category for d in query.all()})
    return jsonify(items=categories)


@bp.get("/<slug>")
def get_document(slug):
    doc = Document.query.filter_by(slug=slug).first()
    if doc is None:
        return jsonify(error={"code": "not_found", "message": "Document not found."}), 404
    if doc.visibility == "internal" and not _may_see_internal():
        return jsonify(error={"code": "forbidden", "message": "This document is internal."}), 403
    return jsonify(doc.to_dict())


@bp.post("")
@permission_required("manage_documents")
def create_document():
    data = request.get_json(silent=True) or {}
    errors = {}
    title = (data.get("title") or "").strip()
    body = (data.get("body") or "").strip()
    category = (data.get("category") or "General").strip() or "General"
    visibility = data.get("visibility", "public")
    if len(title) < 3:
        errors["title"] = "Title is required."
    if len(body) < 3:
        errors["body"] = "Body is required."
    if visibility not in ("public", "internal"):
        errors["visibility"] = "Visibility must be public or internal."
    if errors:
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": errors}), 422
    doc = Document(
        slug=_slugify(title),
        title=title,
        category=category,
        body=body,
        visibility=visibility,
        updated_by_id=g.current_user.id,
    )
    db.session.add(doc)
    db.session.commit()
    return jsonify(doc.to_dict()), 201


@bp.patch("/<slug>")
@permission_required("manage_documents")
def update_document(slug):
    doc = Document.query.filter_by(slug=slug).first()
    if doc is None:
        return jsonify(error={"code": "not_found", "message": "Document not found."}), 404
    data = request.get_json(silent=True) or {}
    if "title" in data:
        title = (data.get("title") or "").strip()
        if len(title) < 3:
            return (
                jsonify(
                    error={
                        "code": "validation_error",
                        "message": "Invalid input.",
                        "details": {"title": "Title is required."},
                    }
                ),
                422,
            )
        doc.title = title
    if "body" in data:
        body = (data.get("body") or "").strip()
        if len(body) < 3:
            return (
                jsonify(
                    error={
                        "code": "validation_error",
                        "message": "Invalid input.",
                        "details": {"body": "Body is required."},
                    }
                ),
                422,
            )
        doc.body = body
    if "category" in data:
        doc.category = (data.get("category") or "General").strip() or "General"
    if "visibility" in data:
        if data["visibility"] not in ("public", "internal"):
            return (
                jsonify(
                    error={
                        "code": "validation_error",
                        "message": "Invalid input.",
                        "details": {"visibility": "Visibility must be public or internal."},
                    }
                ),
                422,
            )
        doc.visibility = data["visibility"]
    doc.updated_by_id = g.current_user.id
    db.session.commit()
    return jsonify(doc.to_dict())
