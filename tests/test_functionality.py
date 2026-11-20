"""Functional acceptance tests: validation, versioning, inventory consistency."""

from tests.conftest import auth


def test_invalid_submissions_rejected_with_useful_errors(client, template_id):
    headers = auth(client, "member")
    resp = client.post(
        "/api/scouting/submissions",
        json={
            "event_name": "Regional",
            "team_number": 1234,
            "template_id": template_id,
            "answers": {
                "drivetrain": "Hovercraft",  # not an option
                "cycles": 500,  # over max
                "climbs": "yes",  # not a boolean
                "notes": 123,  # not text
                "auto": ["Leave", "Fly"],  # invalid option
                "unknown_field": "x",  # unknown key
            },
        },
        headers=headers,
    )
    assert resp.status_code == 422
    details = resp.get_json()["error"]["details"]
    assert "one of the listed options" in details["answers.drivetrain"]
    assert "at most 50" in details["answers.cycles"]
    assert details["answers.climbs"] == "Must be true or false."
    assert details["answers.notes"] == "Must be text."
    assert details["answers.unknown_field"] == "Unknown field."
    assert "listed options" in details["answers.auto"]


def test_missing_required_fields_rejected(client, template_id):
    headers = auth(client, "member")
    resp = client.post(
        "/api/scouting/submissions",
        json={"event_name": "Regional", "team_number": 1234, "template_id": template_id, "answers": {}},
        headers=headers,
    )
    assert resp.status_code == 422
    details = resp.get_json()["error"]["details"]
    assert details["answers.drivetrain"] == "This field is required."
    assert details["answers.cycles"] == "This field is required."
    assert details["answers.climbs"] == "This field is required."


def test_old_submissions_readable_after_template_change(client, template_id):
    headers = auth(client, "member")
    # Submit against version 1.
    resp = client.post(
        "/api/scouting/submissions",
        json={
            "event_name": "Regional",
            "team_number": 1234,
            "template_id": template_id,
            "answers": {"drivetrain": "Swerve", "cycles": 5, "climbs": True, "notes": "v1 note"},
        },
        headers=headers,
    )
    assert resp.status_code == 201
    submission = resp.get_json()
    assert submission["template_version"] == 1

    # Mentor edits the template — fields change, version bumps.
    mentor = auth(client, "mentor")
    resp = client.patch(
        f"/api/scouting/templates/{template_id}",
        json={
            "fields": [
                {"field_key": "drivetrain", "label": "Drivetrain", "field_type": "single_select",
                 "required": True, "options": ["Tank", "Swerve", "Mecanum"]},
                {"field_key": "climbs", "label": "Climbs", "field_type": "checkbox", "required": True},
            ]
        },
        headers=mentor,
    )
    assert resp.status_code == 200
    assert resp.get_json()["version"] == 2

    # The old submission is still readable with its answers intact.
    resp = client.get(f"/api/scouting/submissions/{submission['id']}", headers=headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["template_version"] == 1
    assert data["answers"]["cycles"] == 5
    assert data["answers"]["notes"] == "v1 note"

    # Its immutable version snapshot is still available for rendering.
    resp = client.get(f"/api/scouting/templates/{template_id}/versions/1", headers=headers)
    assert resp.status_code == 200
    assert any(f["field_key"] == "cycles" for f in resp.get_json()["fields"])


def test_inventory_adjustment_updates_quantity_and_creates_history(client):
    headers = auth(client, "mentor")
    resp = client.post(
        "/api/inventory/items",
        json={"name": "Test Motor", "quantity": 10, "unit": "each", "location": "Cabinet A"},
        headers=headers,
    )
    assert resp.status_code == 201
    item = resp.get_json()
    assert item["quantity"] == 10

    resp = client.post(
        f"/api/inventory/items/{item['id']}/adjust",
        json={"quantity_change": -3, "reason": "Used on practice bot"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["item"]["quantity"] == 7

    # Matching history record exists with user + timestamp.
    history = client.get(f"/api/inventory/items/{item['id']}/adjustments", headers=headers).get_json()
    changes = [a["quantity_change"] for a in history["items"]]
    assert changes == [-3, 10]  # newest first
    assert history["items"][0]["user"] == "Mentor"
    assert history["items"][0]["reason"] == "Used on practice bot"
    assert history["items"][0]["created_at"]

    # Adjustment that would go negative is rejected.
    resp = client.post(
        f"/api/inventory/items/{item['id']}/adjust",
        json={"quantity_change": -100, "reason": "too much"},
        headers=headers,
    )
    assert resp.status_code == 422
    assert "negative" in resp.get_json()["error"]["details"]["quantity_change"]


def test_quantity_cannot_be_set_directly_via_patch(client):
    """Quantity changes must go through the adjustment endpoint."""
    headers = auth(client, "mentor")
    item = client.post(
        "/api/inventory/items",
        json={"name": "Guarded Item", "quantity": 5},
        headers=headers,
    ).get_json()
    resp = client.patch(f"/api/inventory/items/{item['id']}", json={"quantity": 999}, headers=headers)
    assert resp.status_code == 200
    assert resp.get_json()["quantity"] == 5  # unchanged


def test_template_management_permission(client, template_id):
    """Leads and members cannot create or edit scouting templates."""
    for role in ("lead", "member"):
        resp = client.patch(
            f"/api/scouting/templates/{template_id}",
            json={"name": "Hijacked"},
            headers=auth(client, role),
        )
        assert resp.status_code == 403
    resp = client.patch(
        f"/api/scouting/templates/{template_id}", json={"name": "Mentor Rename"}, headers=auth(client, "mentor")
    )
    assert resp.status_code == 200


def test_registration_requires_valid_input(client):
    resp = client.post(
        "/api/auth/register",
        json={"name": "X", "email": "not-an-email", "password": "short"},
    )
    assert resp.status_code == 422
    details = resp.get_json()["error"]["details"]
    assert "email" in details and "password" in details

    resp = client.post(
        "/api/auth/register",
        json={"name": "New Student", "email": "new@student.test", "password": "longenough1"},
    )
    assert resp.status_code == 201
    assert resp.get_json()["status"] == "pending"  # new accounts start pending


def test_invalid_token_rejected(client):
    resp = client.get("/api/members", headers={"Authorization": "Bearer forged.token.here"})
    assert resp.status_code == 401


def test_csv_export_requires_authentication(client):
    resp = client.get("/api/scouting/submissions/export")
    assert resp.status_code == 401
    resp = client.get("/api/scouting/submissions/export", headers=auth(client, "pending"))
    assert resp.status_code == 403
