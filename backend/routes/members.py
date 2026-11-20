"""Member management endpoints (role + status handling, directory)."""

from flask import Blueprint, g, jsonify, request

from backend import db
from backend.models import InventoryAdjustment, NewsPost, ScoutingSubmission, User
from backend.permissions import ROLES, STATUSES, can
from backend.security import active_required, permission_required

bp = Blueprint("members", __name__, url_prefix="/api/members")


def _paginate(query, page, per_page):
    total = query.count()
    items = query.limit(per_page).offset((page - 1) * per_page).all()
    return items, total


@bp.get("")
@active_required
def list_members():
    """Internal member directory. Requires an approved member (provisional rule).

    Emails are private and are only included for users who may manage members;
    everyone else sees names, roles, and statuses.
    """
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 50, type=int)))
    status = request.args.get("status")
    role = request.args.get("role")
    query = User.query
    if status in STATUSES:
        query = query.filter_by(status=status)
    if role in ROLES:
        query = query.filter_by(role=role)
    query = query.order_by(User.name)
    users, total = _paginate(query, page, per_page)
    include_private = can(g.current_user, "approve_members")
    return jsonify(
        items=[u.to_dict(include_private=include_private) for u in users],
        page=page,
        per_page=per_page,
        total=total,
    )


@bp.get("/<int:user_id>")
@active_required
def get_member(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        return jsonify(error={"code": "not_found", "message": "Member not found."}), 404
    include_private = can(g.current_user, "approve_members")
    return jsonify(user.to_dict(include_private=include_private))


@bp.patch("/<int:user_id>")
@permission_required("assign_roles")
def update_role(user_id):
    """Change a member's role. Users cannot change their own role."""
    target = db.session.get(User, user_id)
    if target is None:
        return jsonify(error={"code": "not_found", "message": "Member not found."}), 404
    data = request.get_json(silent=True) or {}
    role = data.get("role")
    if role not in ROLES:
        return (
            jsonify(
                error={
                    "code": "validation_error",
                    "message": "Invalid input.",
                    "details": {"role": "Role must be one of: mentor, captain, lead, member."},
                }
            ),
            422,
        )
    if target.id == g.current_user.id:
        return (
            jsonify(
                error={
                    "code": "forbidden",
                    "message": "You cannot change your own role.",
                }
            ),
            403,
        )
    target.role = role
    db.session.commit()
    return jsonify(target.to_dict(include_private=True))


@bp.post("/<int:user_id>/approve")
@permission_required("approve_members")
def approve_member(user_id):
    """Approve a pending member. Users cannot approve themselves."""
    target = db.session.get(User, user_id)
    if target is None:
        return jsonify(error={"code": "not_found", "message": "Member not found."}), 404
    if target.id == g.current_user.id:
        return (
            jsonify(error={"code": "forbidden", "message": "You cannot approve your own account."}),
            403,
        )
    target.status = "approved"
    db.session.commit()
    return jsonify(target.to_dict(include_private=True))


@bp.post("/<int:user_id>/suspend")
@permission_required("approve_members")
def suspend_member(user_id):
    """Suspend a member. Users cannot suspend themselves."""
    target = db.session.get(User, user_id)
    if target is None:
        return jsonify(error={"code": "not_found", "message": "Member not found."}), 404
    if target.id == g.current_user.id:
        return (
            jsonify(error={"code": "forbidden", "message": "You cannot suspend your own account."}),
            403,
        )
    target.status = "suspended"
    db.session.commit()
    return jsonify(target.to_dict(include_private=True))


@bp.delete("/<int:user_id>")
@permission_required("delete_members")
def delete_member(user_id):
    """Permanently delete a member (mentors only).

    Related records are preserved, not destroyed:
      - news posts and scouting submissions: kept, author unlinked
        (shown as a former member)
      - inventory adjustment history: kept, user unlinked
    Users cannot delete their own account.
    """
    target = db.session.get(User, user_id)
    if target is None:
        return jsonify(error={"code": "not_found", "message": "Member not found."}), 404
    if target.id == g.current_user.id:
        return (
            jsonify(error={"code": "forbidden", "message": "You cannot delete your own account."}),
            403,
        )

    # Unlink (do not destroy) content and history that references the member.
    for post in NewsPost.query.filter_by(author_id=user_id):
        post.author_id = None
    for sub in ScoutingSubmission.query.filter_by(author_id=user_id):
        sub.author_id = None
    for adj in InventoryAdjustment.query.filter_by(user_id=user_id):
        adj.user_id = None

    db.session.delete(target)
    db.session.commit()
    return jsonify(ok=True)
