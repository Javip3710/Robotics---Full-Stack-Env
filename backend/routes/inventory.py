"""Inventory endpoints. REQUIRED rule: approved mentors and captains only."""

from functools import wraps

from flask import Blueprint, g, jsonify, request

from backend import db
from backend.models import InventoryAdjustment, InventoryItem
from backend.security import active_required

bp = Blueprint("inventory", __name__, url_prefix="/api/inventory")


def _mentor_or_captain():
    return g.current_user.role in ("mentor", "captain")


def inventory_guard(f):
    """Required rule: inventory pages and API operations are for approved
    mentors and captains only. This is enforced server-side on every request."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        if not _mentor_or_captain():
            return (
                jsonify(
                    error={
                        "code": "forbidden",
                        "message": "Inventory is restricted to approved mentors and captains.",
                    }
                ),
                403,
            )
        return f(*args, **kwargs)

    return wrapper


@bp.get("/items")
@active_required
@inventory_guard
def list_items():
    """Search + category/location filters. ?include_archived=1 shows archived items."""
    query = InventoryItem.query
    search = request.args.get("search")
    if search:
        like = f"%{search}%"
        query = query.filter(
            (InventoryItem.name.ilike(like))
            | (InventoryItem.part_number.ilike(like))
            | (InventoryItem.notes.ilike(like))
        )
    category = request.args.get("category")
    if category:
        query = query.filter(InventoryItem.category.ilike(f"%{category}%"))
    location = request.args.get("location")
    if location:
        query = query.filter(InventoryItem.location.ilike(f"%{location}%"))
    if request.args.get("include_archived") != "1":
        query = query.filter_by(archived=False)
    items = query.order_by(InventoryItem.name).all()
    return jsonify(items=[i.to_dict() for i in items], total=len(items))


@bp.get("/categories")
@active_required
@inventory_guard
def list_categories():
    categories = sorted(
        {i.category for i in InventoryItem.query.filter_by(archived=False).all() if i.category}
    )
    return jsonify(items=categories)


@bp.post("/items")
@active_required
@inventory_guard
def create_item():
    data = request.get_json(silent=True) or {}
    errors = {}
    name = (data.get("name") or "").strip()
    if len(name) < 2:
        errors["name"] = "Name is required."
    try:
        quantity = float(data.get("quantity", 0))
    except (TypeError, ValueError):
        errors["quantity"] = "Quantity must be a number."
        quantity = None
    else:
        if quantity < 0:
            errors["quantity"] = "Quantity cannot be negative."
    if errors:
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": errors}), 422
    item = InventoryItem(
        name=name,
        category=(data.get("category") or "General").strip() or "General",
        quantity=quantity,
        unit=(data.get("unit") or "each").strip() or "each",
        location=(data.get("location") or "").strip(),
        part_number=(data.get("part_number") or "").strip() or None,
        notes=(data.get("notes") or "").strip(),
        low_stock_threshold=_parse_threshold(data.get("low_stock_threshold")),
    )
    db.session.add(item)
    db.session.flush()
    # Initial quantity is recorded as an adjustment so history starts at creation.
    if quantity:
        db.session.add(
            InventoryAdjustment(
                item_id=item.id,
                quantity_change=quantity,
                reason="Initial stock",
                user_id=g.current_user.id,
            )
        )
    db.session.commit()
    return jsonify(item.to_dict()), 201


@bp.get("/items/<int:item_id>")
@active_required
@inventory_guard
def get_item(item_id):
    item = db.session.get(InventoryItem, item_id)
    if item is None:
        return jsonify(error={"code": "not_found", "message": "Item not found."}), 404
    return jsonify(item.to_dict())


@bp.patch("/items/<int:item_id>")
@active_required
@inventory_guard
def update_item(item_id):
    item = db.session.get(InventoryItem, item_id)
    if item is None:
        return jsonify(error={"code": "not_found", "message": "Item not found."}), 404
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if len(name) < 2:
            return (
                jsonify(
                    error={
                        "code": "validation_error",
                        "message": "Invalid input.",
                        "details": {"name": "Name is required."},
                    }
                ),
                422,
            )
        item.name = name
    for key in ("category", "unit", "location", "notes"):
        if key in data:
            setattr(item, key, (data.get(key) or "").strip())
    if "part_number" in data:
        item.part_number = (data.get("part_number") or "").strip() or None
    if "low_stock_threshold" in data:
        item.low_stock_threshold = _parse_threshold(data.get("low_stock_threshold"))
    if "archived" in data:
        # Archiving (not deleting) keeps adjustment history intact.
        item.archived = bool(data["archived"])
    # NOTE: quantity changes must go through the adjustment endpoint so that
    # every change has a matching history record.
    db.session.commit()
    return jsonify(item.to_dict())


@bp.post("/items/<int:item_id>/adjust")
@active_required
@inventory_guard
def adjust_item(item_id):
    """Record a stock change: quantity delta + reason + user + timestamp."""
    item = db.session.get(InventoryItem, item_id)
    if item is None:
        return jsonify(error={"code": "not_found", "message": "Item not found."}), 404
    data = request.get_json(silent=True) or {}
    errors = {}
    try:
        change = float(data.get("quantity_change"))
    except (TypeError, ValueError):
        change = None
        errors["quantity_change"] = "Quantity change must be a number (use negative values for removals)."
    else:
        if change == 0:
            errors["quantity_change"] = "Quantity change cannot be zero."
        elif item.quantity + change < 0:
            errors["quantity_change"] = f"Adjustment would make quantity negative (current: {item.quantity:g})."
    reason = (data.get("reason") or "").strip()
    if len(reason) < 3:
        errors["reason"] = "A reason is required."
    if errors:
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": errors}), 422
    item.quantity += change
    db.session.add(
        InventoryAdjustment(
            item_id=item.id,
            quantity_change=change,
            reason=reason,
            user_id=g.current_user.id,
        )
    )
    db.session.commit()
    return jsonify(item=item.to_dict(), adjustment_created=True)


@bp.get("/items/<int:item_id>/adjustments")
@active_required
@inventory_guard
def item_adjustments(item_id):
    item = db.session.get(InventoryItem, item_id)
    if item is None:
        return jsonify(error={"code": "not_found", "message": "Item not found."}), 404
    adjustments = (
        InventoryAdjustment.query.filter_by(item_id=item_id)
        .order_by(InventoryAdjustment.created_at.desc())
        .all()
    )
    return jsonify(items=[a.to_dict() for a in adjustments], total=len(adjustments))


@bp.get("/adjustments")
@active_required
@inventory_guard
def all_adjustments():
    """Recent adjustment history across all items."""
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 50, type=int)))
    query = InventoryAdjustment.query.order_by(InventoryAdjustment.created_at.desc())
    total = query.count()
    adjustments = query.limit(per_page).offset((page - 1) * per_page).all()
    return jsonify(
        items=[a.to_dict() for a in adjustments], page=page, per_page=per_page, total=total
    )


def _parse_threshold(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
