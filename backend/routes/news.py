"""News endpoints. Only published posts are visible publicly."""

import nh3

from flask import Blueprint, g, jsonify, request

from backend import db
from backend.models import NewsPost, utcnow
from backend.permissions import can
from backend.security import load_current_user, permission_required

bp = Blueprint("news", __name__, url_prefix="/api/news")

FEATURED_LIMIT = 1

# The news body is rich text (HTML from the editor). Everything is sanitized
# server-side before storage; anything outside this allowlist is stripped.
ALLOWED_TAGS = {
    "p", "br", "strong", "b", "em", "i", "u", "s", "sub", "sup",
    "h2", "h3", "h4", "ul", "ol", "li", "blockquote",
    "a", "img", "code", "pre", "hr", "figure", "figcaption",
}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target"},  # nh3 manages rel="noopener noreferrer" itself
    "img": {"src", "alt", "title", "width", "height"},
}


def _clean_body(html):
    return nh3.clean(html or "", tags=ALLOWED_TAGS, attributes=ALLOWED_ATTRIBUTES)


def _may_manage():
    user = load_current_user()
    return user if (user is not None and user.status == "approved" and can(user, "publish_news")) else None


@bp.get("")
def list_news():
    """Public: published posts. Managers may pass ?include_drafts=1 to see drafts."""
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(50, max(1, request.args.get("per_page", 10, type=int)))
    manager = _may_manage()
    include_drafts = request.args.get("include_drafts") == "1" and manager is not None
    query = NewsPost.query
    if not include_drafts:
        query = query.filter_by(published=True)
    query = query.order_by(NewsPost.published_at.desc().nullslast(), NewsPost.created_at.desc())
    total = query.count()
    posts = query.limit(per_page).offset((page - 1) * per_page).all()
    return jsonify(items=[p.to_dict() for p in posts], page=page, per_page=per_page, total=total)


@bp.get("/featured")
def featured_news():
    post = (
        NewsPost.query.filter_by(published=True, featured=True)
        .order_by(NewsPost.published_at.desc())
        .first()
    )
    return jsonify(post=post.to_dict() if post else None)


@bp.get("/<int:post_id>")
def get_news(post_id):
    post = db.session.get(NewsPost, post_id)
    if post is None:
        return jsonify(error={"code": "not_found", "message": "News post not found."}), 404
    if not post.published and _may_manage() is None:
        return jsonify(error={"code": "forbidden", "message": "This post is not published."}), 403
    return jsonify(post=post.to_dict())


@bp.post("")
@permission_required("publish_news")
def create_news():
    data = request.get_json(silent=True) or {}
    errors = {}
    title = (data.get("title") or "").strip()
    summary = (data.get("summary") or "").strip()
    body = _clean_body(data.get("body") or "")
    if len(title) < 3:
        errors["title"] = "Title is required."
    if len(summary) < 3:
        errors["summary"] = "Summary is required."
    if len(body) < 3:
        errors["body"] = "Body is required."
    if errors:
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": errors}), 422
    post = NewsPost(
        title=title,
        summary=summary,
        body=body,
        author_id=g.current_user.id,
        published=bool(data.get("published", False)),
        published_at=utcnow() if data.get("published") else None,
        featured=bool(data.get("featured", False)),
    )
    db.session.add(post)
    db.session.commit()
    return jsonify(post=post.to_dict()), 201


@bp.patch("/<int:post_id>")
@permission_required("publish_news")
def update_news(post_id):
    post = db.session.get(NewsPost, post_id)
    if post is None:
        return jsonify(error={"code": "not_found", "message": "News post not found."}), 404
    data = request.get_json(silent=True) or {}
    for key in ("title", "summary", "body"):
        if key in data:
            if key == "body":
                value = _clean_body(data.get(key) or "")
            else:
                value = (data.get(key) or "").strip()
            if len(value) < 3:
                return (
                    jsonify(
                        error={
                            "code": "validation_error",
                            "message": "Invalid input.",
                            "details": {key: "This field is required."},
                        }
                    ),
                    422,
                )
            setattr(post, key, value)
    if "published" in data:
        was_published = post.published
        post.published = bool(data["published"])
        if post.published and not was_published:
            post.published_at = utcnow()
    if "featured" in data:
        post.featured = bool(data["featured"])
    db.session.commit()
    return jsonify(post=post.to_dict())
