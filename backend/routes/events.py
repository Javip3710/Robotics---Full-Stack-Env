"""Event endpoints (upcoming dates on the home page; event choices for scouting)."""

from datetime import date

from flask import Blueprint, jsonify, request

from backend import db
from backend.models import Event
from backend.security import permission_required

bp = Blueprint("events", __name__, url_prefix="/api/events")


@bp.get("")
def list_events():
    """Public. ?upcoming=1 limits to events on/after today."""
    query = Event.query
    if request.args.get("upcoming") == "1":
        query = query.filter(Event.event_date >= date.today())
    events = query.order_by(Event.event_date).all()
    return jsonify(items=[e.to_dict() for e in events])


@bp.post("")
@permission_required("manage_events")
def create_event():
    data = request.get_json(silent=True) or {}
    values, errors = _validate(data)
    if errors:
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": errors}), 422
    event = Event(**values)
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


def _validate(data, partial=False):
    """Validate all fields before mutating a model (including partial edits)."""
    if not isinstance(data, dict):
        return {}, {"body": "A JSON object is required."}
    values = {}
    errors = {}
    for field, limit in (("name", 200), ("location", 200), ("description", 10000)):
        if partial and field not in data:
            continue
        value = data.get(field, "")
        if not isinstance(value, str):
            errors[field] = "Must be text."
            continue
        value = value.strip()
        if field == "name" and len(value) < 3:
            errors[field] = "Name must contain at least 3 characters."
        elif len(value) > limit:
            errors[field] = f"Must be {limit} characters or fewer."
        else:
            values[field] = value
    if not partial or "date" in data:
        raw_date = data.get("date")
        try:
            if not isinstance(raw_date, str) or len(raw_date) != 10:
                raise ValueError
            values["event_date"] = date.fromisoformat(raw_date)
        except ValueError:
            errors["date"] = "A valid date (YYYY-MM-DD) is required."
    return values, errors


@bp.patch("/<int:event_id>")
@permission_required("manage_events")
def update_event(event_id):
    event = db.session.get(Event, event_id)
    if event is None:
        return jsonify(error={"code": "not_found", "message": "Event not found."}), 404
    values, errors = _validate(request.get_json(silent=True) or {}, partial=True)
    if errors:
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": errors}), 422
    for key, value in values.items():
        setattr(event, key, value)
    db.session.commit()
    return jsonify(event.to_dict())


@bp.delete("/<int:event_id>")
@permission_required("manage_events")
def delete_event(event_id):
    event = db.session.get(Event, event_id)
    if event is None:
        return jsonify(error={"code": "not_found", "message": "Event not found."}), 404
    # Scouting keeps its event_name string, so deleting an event does not
    # cascade to scouting submissions or change historical records.
    db.session.delete(event)
    db.session.commit()
    return jsonify(ok=True)
