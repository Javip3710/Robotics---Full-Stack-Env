"""Scouting endpoints: templates (with versioning), submissions, results, CSV export."""

import csv
import io
import re

from flask import Blueprint, Response, g, jsonify, request

from backend import db
from backend.models import ScoutingField, ScoutingSubmission, ScoutingTemplate, ScoutingTemplateVersion
from backend.permissions import can
from backend.security import active_required, permission_required

bp = Blueprint("scouting", __name__, url_prefix="/api/scouting")

FIELD_TYPES = ("short_text", "long_text", "number", "checkbox", "single_select", "multi_select")
TEMPLATE_STATUSES = ("draft", "active", "archived")
KEY_RE = re.compile(r"^[a-z][a-z0-9_]*$")


# ---------------------------------------------------------------------------
# Template definition validation (server side, shared by create/update)
# ---------------------------------------------------------------------------

def _validate_field_definitions(fields_data):
    """Validate a list of field definitions. Returns (fields, errors)."""
    errors = {}
    normalized = []
    if not isinstance(fields_data, list) or len(fields_data) == 0:
        return None, {"fields": "At least one field is required."}
    seen_keys = set()
    for i, f in enumerate(fields_data):
        prefix = f"fields[{i}]"
        if not isinstance(f, dict):
            errors[f"{prefix}"] = "Field definition must be an object."
            continue
        field_key = (f.get("field_key") or "").strip()
        label = (f.get("label") or "").strip()
        field_type = f.get("field_type")
        if not KEY_RE.match(field_key):
            errors[f"{prefix}.field_key"] = "Field key must start with a letter and use lowercase letters, digits, or underscores."
        if field_key in seen_keys:
            errors[f"{prefix}.field_key"] = "Duplicate field key."
        seen_keys.add(field_key)
        if len(label) < 1:
            errors[f"{prefix}.label"] = "Label is required."
        if field_type not in FIELD_TYPES:
            errors[f"{prefix}.field_type"] = f"Field type must be one of: {', '.join(FIELD_TYPES)}."
        options = f.get("options") or []
        if field_type in ("single_select", "multi_select"):
            if not isinstance(options, list) or len(options) == 0 or not all(isinstance(o, str) and o.strip() for o in options):
                errors[f"{prefix}.options"] = "Select fields require at least one non-empty option."
        min_value = f.get("min_value")
        max_value = f.get("max_value")
        if min_value is not None and not isinstance(min_value, (int, float)):
            errors[f"{prefix}.min_value"] = "min_value must be a number."
        if max_value is not None and not isinstance(max_value, (int, float)):
            errors[f"{prefix}.max_value"] = "max_value must be a number."
        if (
            isinstance(min_value, (int, float))
            and isinstance(max_value, (int, float))
            and min_value > max_value
        ):
            errors[f"{prefix}.max_value"] = "max_value must be greater than or equal to min_value."
        normalized.append(
            {
                "field_key": field_key,
                "label": label,
                "field_type": field_type,
                "required": bool(f.get("required", False)),
                "help_text": (f.get("help_text") or "").strip(),
                "options": [str(o) for o in options] if field_type in ("single_select", "multi_select") else [],
                "min_value": min_value,
                "max_value": max_value,
            }
        )
    if errors:
        return None, errors
    for position, f in enumerate(normalized):
        f["position"] = position
    return normalized, None


def _save_template_fields(template, fields_data):
    """Replace a template's fields, bump its version, and store an immutable snapshot."""
    fields, errors = _validate_field_definitions(fields_data)
    if errors:
        return errors
    ScoutingField.query.filter_by(template_id=template.id).delete()
    for f in fields:
        db.session.add(
            ScoutingField(
                template_id=template.id,
                field_key=f["field_key"],
                label=f["label"],
                field_type=f["field_type"],
                required=f["required"],
                help_text=f["help_text"],
                options=f["options"] or None,
                min_value=f["min_value"],
                max_value=f["max_value"],
                position=f["position"],
            )
        )
    template.current_version += 1
    version = ScoutingTemplateVersion(
        template_id=template.id,
        version=template.current_version,
        fields=fields,
    )
    db.session.add(version)
    db.session.flush()
    return None


# ---------------------------------------------------------------------------
# Answer validation (server side, mirrors the frontend rules)
# ---------------------------------------------------------------------------

def validate_answers(fields, answers):
    """Validate submitted answers against field definitions. Returns errors dict."""
    errors = {}
    if not isinstance(answers, dict):
        return {"_answers": "Answers must be an object keyed by field IDs."}
    valid_keys = {f["field_key"] for f in fields}
    for key in answers:
        if key not in valid_keys:
            errors[key] = "Unknown field."
    for f in fields:
        key = f["field_key"]
        value = answers.get(key)
        if f["required"] and (value is None or value == "" or value == []):
            errors[key] = "This field is required."
            continue
        if value is None or value == "":
            continue
        t = f["field_type"]
        if t == "short_text" or t == "long_text":
            if not isinstance(value, str):
                errors[key] = "Must be text."
            elif t == "short_text" and len(value) > 300:
                errors[key] = "Must be 300 characters or fewer."
        elif t == "number":
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                errors[key] = "Must be a number."
            elif f.get("min_value") is not None and value < f["min_value"]:
                errors[key] = f"Must be at least {f['min_value']}."
            elif f.get("max_value") is not None and value > f["max_value"]:
                errors[key] = f"Must be at most {f['max_value']}."
        elif t == "checkbox":
            if not isinstance(value, bool):
                errors[key] = "Must be true or false."
        elif t == "single_select":
            if value not in (f.get("options") or []):
                errors[key] = "Must be one of the listed options."
        elif t == "multi_select":
            if not isinstance(value, list) or any(v not in (f.get("options") or []) for v in value):
                errors[key] = "Each selection must be one of the listed options."
    return errors


# ---------------------------------------------------------------------------
# Templates
# ---------------------------------------------------------------------------

@bp.get("/templates")
@active_required
def list_templates():
    """Active templates for submission; ?status= filters (managers may see all statuses)."""
    status = request.args.get("status")
    query = ScoutingTemplate.query
    if status in TEMPLATE_STATUSES:
        query = query.filter_by(status=status)
    elif not can(g.current_user, "manage_scouting_templates"):
        query = query.filter_by(status="active")
    templates = query.order_by(ScoutingTemplate.name).all()
    return jsonify(items=[t.to_dict() for t in templates], total=len(templates))


@bp.get("/templates/<int:template_id>")
@active_required
def get_template(template_id):
    template = db.session.get(ScoutingTemplate, template_id)
    if template is None:
        return jsonify(error={"code": "not_found", "message": "Template not found."}), 404
    if template.status != "active" and not can(g.current_user, "manage_scouting_templates"):
        return (
            jsonify(error={"code": "forbidden", "message": "This template is not active."}),
            403,
        )
    return jsonify(template.to_dict())


@bp.post("/templates")
@permission_required("manage_scouting_templates")
def create_template():
    data = request.get_json(silent=True) or {}
    errors = {}
    name = (data.get("name") or "").strip()
    if len(name) < 3:
        errors["name"] = "Name is required."
    status = data.get("status", "draft")
    if status not in TEMPLATE_STATUSES:
        errors["status"] = "Status must be draft, active, or archived."
    if errors:
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": errors}), 422
    template = ScoutingTemplate(
        name=name,
        description=(data.get("description") or "").strip(),
        season=(data.get("season") or "").strip(),
        status=status,
        current_version=0,
    )
    db.session.add(template)
    db.session.flush()
    field_errors = _save_template_fields(template, data.get("fields") or [])
    if field_errors:
        db.session.rollback()
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": field_errors}), 422
    db.session.commit()
    return jsonify(template.to_dict()), 201


@bp.patch("/templates/<int:template_id>")
@permission_required("manage_scouting_templates")
def update_template(template_id):
    template = db.session.get(ScoutingTemplate, template_id)
    if template is None:
        return jsonify(error={"code": "not_found", "message": "Template not found."}), 404
    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if len(name) < 3:
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
        template.name = name
    if "description" in data:
        template.description = (data.get("description") or "").strip()
    if "season" in data:
        template.season = (data.get("season") or "").strip()
    if "status" in data:
        if data["status"] not in TEMPLATE_STATUSES:
            return (
                jsonify(
                    error={
                        "code": "validation_error",
                        "message": "Invalid input.",
                        "details": {"status": "Status must be draft, active, or archived."},
                    }
                ),
                422,
            )
        template.status = data["status"]
    if "fields" in data:
        field_errors = _save_template_fields(template, data["fields"])
        if field_errors:
            db.session.rollback()
            return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": field_errors}), 422
    db.session.commit()
    return jsonify(template.to_dict())


@bp.get("/templates/<int:template_id>/versions/<int:version>")
@active_required
def get_template_version(template_id, version):
    """Fetch an immutable version snapshot (used to render old submissions)."""
    snap = (
        ScoutingTemplateVersion.query.filter_by(template_id=template_id, version=version).first()
    )
    if snap is None:
        return jsonify(error={"code": "not_found", "message": "Template version not found."}), 404
    return jsonify(
        template_id=template_id,
        version=version,
        fields=snap.fields,
        created_at=snap.created_at.isoformat() if snap.created_at else None,
    )


# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------

def _submission_filters(query):
    event = request.args.get("event")
    team = request.args.get("team", type=int)
    match = request.args.get("match")
    template_id = request.args.get("template", type=int)
    if event:
        query = query.filter(ScoutingSubmission.event_name.ilike(f"%{event}%"))
    if team is not None:
        query = query.filter_by(team_number=team)
    if match:
        query = query.filter(ScoutingSubmission.match_key.ilike(f"%{match}%"))
    if template_id is not None:
        query = query.filter_by(template_id=template_id)
    return query


@bp.post("/submissions")
@active_required
def create_submission():
    """Approved members submit scouting data. The author is assigned by the backend."""
    data = request.get_json(silent=True) or {}
    errors = {}
    event_name = (data.get("event_name") or "").strip()
    if len(event_name) < 2:
        errors["event_name"] = "Event is required."
    team_number = data.get("team_number")
    if isinstance(team_number, bool) or not isinstance(team_number, int) or team_number < 1:
        errors["team_number"] = "Team number must be a positive integer."
    match_key = (data.get("match_key") or "").strip() or None
    template = db.session.get(ScoutingTemplate, data.get("template_id") or 0)
    if template is None:
        errors["template_id"] = "Select a valid template."
    elif template.status != "active":
        errors["template_id"] = "This template is not active."
    answers = data.get("answers")
    if template is not None and template.status == "active":
        fields = [f.to_dict() for f in template.ordered_fields()]
        answer_errors = validate_answers(fields, answers or {})
        for k, v in answer_errors.items():
            errors[f"answers.{k}"] = v
    if errors:
        return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": errors}), 422
    submission = ScoutingSubmission(
        event_name=event_name,
        team_number=team_number,
        match_key=match_key,
        template_id=template.id,
        template_version=template.current_version,
        answers=answers,
        author_id=g.current_user.id,  # never taken from the request
    )
    db.session.add(submission)
    db.session.commit()
    return jsonify(submission.to_dict()), 201


@bp.get("/submissions")
@active_required
def list_submissions():
    """Results table with filters (provisional rule: approved members may view)."""
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(200, max(1, request.args.get("per_page", 25, type=int)))
    query = _submission_filters(ScoutingSubmission.query).order_by(
        ScoutingSubmission.created_at.desc()
    )
    total = query.count()
    items = query.limit(per_page).offset((page - 1) * per_page).all()
    return jsonify(
        items=[s.to_dict(include_answers=False) for s in items],
        page=page,
        per_page=per_page,
        total=total,
    )


@bp.get("/submissions/export")
@active_required
def export_submissions():
    """CSV export, same filters as the list, restricted by the same permission."""
    query = _submission_filters(ScoutingSubmission.query).order_by(
        ScoutingSubmission.created_at.desc()
    )
    submissions = query.all()
    # CSV columns: metadata + one column per field of each submission's version.
    field_defs = {}
    for s in submissions:
        snap = (
            ScoutingTemplateVersion.query.filter_by(
                template_id=s.template_id, version=s.template_version
            ).first()
        )
        for f in snap.fields if snap else []:
            field_defs[(s.template_id, f["field_key"])] = f["label"]
    buf = io.StringIO()
    writer = csv.writer(buf)
    header = ["id", "event", "team_number", "match", "template", "template_version", "author", "created_at"]
    header += [label for (_, _), label in sorted(field_defs.items())]
    writer.writerow(header)
    for s in submissions:
        row = [
            s.id,
            s.event_name,
            s.team_number,
            s.match_key or "",
            s.template.name if s.template else "",
            s.template_version,
            s.author.name if s.author else "",
            s.created_at.isoformat() if s.created_at else "",
        ]
        snap = (
            ScoutingTemplateVersion.query.filter_by(
                template_id=s.template_id, version=s.template_version
            ).first()
        )
        for (tid, key), _label in sorted(field_defs.items()):
            if tid == s.template_id:
                value = (s.answers or {}).get(key, "")
                if isinstance(value, list):
                    value = "; ".join(str(v) for v in value)
                row.append(value)
            else:
                row.append("")
        writer.writerow(row)
    return Response(
        buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": "attachment; filename=scouting-submissions.csv"},
    )


@bp.get("/submissions/<int:submission_id>")
@active_required
def get_submission(submission_id):
    submission = db.session.get(ScoutingSubmission, submission_id)
    if submission is None:
        return jsonify(error={"code": "not_found", "message": "Submission not found."}), 404
    return jsonify(submission.to_dict())


@bp.patch("/submissions/<int:submission_id>")
@active_required
def update_submission(submission_id):
    """Correct a submission. Provisional rule: the author, or a mentor/captain."""
    submission = db.session.get(ScoutingSubmission, submission_id)
    if submission is None:
        return jsonify(error={"code": "not_found", "message": "Submission not found."}), 404
    is_author = submission.author_id == g.current_user.id
    is_manager = can(g.current_user, "edit_any_scouting_submission")
    if not (is_author or is_manager):
        return (
            jsonify(
                error={
                    "code": "forbidden",
                    "message": "You may only edit your own submissions.",
                }
            ),
            403,
        )
    data = request.get_json(silent=True) or {}
    if "answers" in data:
        snap = (
            ScoutingTemplateVersion.query.filter_by(
                template_id=submission.template_id, version=submission.template_version
            ).first()
        )
        fields = snap.fields if snap else []
        answer_errors = validate_answers(fields, data["answers"] or {})
        if answer_errors:
            details = {f"answers.{k}": v for k, v in answer_errors.items()}
            return jsonify(error={"code": "validation_error", "message": "Invalid input.", "details": details}), 422
        submission.answers = data["answers"]
    for key in ("event_name", "match_key"):
        if key in data:
            value = (data.get(key) or "").strip()
            if len(value) < 2:
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
            setattr(submission, key, value or None)
    if "team_number" in data:
        tn = data["team_number"]
        if isinstance(tn, bool) or not isinstance(tn, int) or tn < 1:
            return (
                jsonify(
                    error={
                        "code": "validation_error",
                        "message": "Invalid input.",
                        "details": {"team_number": "Team number must be a positive integer."},
                    }
                ),
                422,
            )
        submission.team_number = tn
    db.session.commit()
    return jsonify(submission.to_dict())


@bp.delete("/submissions/<int:submission_id>")
@active_required
def delete_submission(submission_id):
    """Delete a submission. Provisional rule: the author, or a mentor/captain."""
    submission = db.session.get(ScoutingSubmission, submission_id)
    if submission is None:
        return jsonify(error={"code": "not_found", "message": "Submission not found."}), 404
    is_author = submission.author_id == g.current_user.id
    is_manager = can(g.current_user, "edit_any_scouting_submission")
    if not (is_author or is_manager):
        return (
            jsonify(error={"code": "forbidden", "message": "You may only delete your own submissions."}),
            403,
        )
    db.session.delete(submission)
    db.session.commit()
    return jsonify(ok=True)
