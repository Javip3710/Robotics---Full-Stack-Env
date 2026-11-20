import os

import pytest

from backend import create_app, db
from backend.models import User
from backend.security import hash_password


@pytest.fixture()
def app(tmp_path):
    # Isolate the test database BEFORE create_app reads its config, so tests
    # never touch the developer's real database.
    os.environ["DATABASE_URL"] = f"sqlite:///{tmp_path}/test.db"
    app = create_app()
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{tmp_path}/test.db"
    app.config["SECRET_KEY"] = "test-secret"
    with app.app_context():
        db.drop_all()
        db.create_all()
        users = {
            "mentor": User(
                email="mentor@test", name="Mentor", password_hash=hash_password("pw1234567"),
                role="mentor", status="approved",
            ),
            "captain": User(
                email="captain@test", name="Captain", password_hash=hash_password("pw1234567"),
                role="captain", status="approved",
            ),
            "lead": User(
                email="lead@test", name="Lead", password_hash=hash_password("pw1234567"),
                role="lead", status="approved",
            ),
            "member": User(
                email="member@test", name="Member", password_hash=hash_password("pw1234567"),
                role="member", status="approved",
            ),
            "pending": User(
                email="pending@test", name="Pending", password_hash=hash_password("pw1234567"),
                role="member", status="pending",
            ),
            "suspended": User(
                email="suspended@test", name="Suspended", password_hash=hash_password("pw1234567"),
                role="member", status="suspended",
            ),
        }
        for u in users.values():
            db.session.add(u)
        db.session.commit()
        app.config["_test_users"] = {k: u.id for k, u in users.items()}
    yield app


@pytest.fixture()
def client(app):
    return app.test_client()


def auth(client, role):
    """Get a bearer token for the given seeded role."""
    resp = client.post("/api/auth/login", json={"email": f"{role}@test", "password": "pw1234567"})
    assert resp.status_code == 200, resp.get_json()
    token = resp.get_json()["token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def template_id(client):
    """Create an active scouting template as the mentor."""
    headers = auth(client, "mentor")
    resp = client.post(
        "/api/scouting/templates",
        json={
            "name": "Test Template",
            "description": "",
            "season": "2027",
            "status": "active",
            "fields": [
                {"field_key": "drivetrain", "label": "Drivetrain", "field_type": "single_select",
                 "required": True, "options": ["Tank", "Swerve"]},
                {"field_key": "cycles", "label": "Cycles", "field_type": "number",
                 "required": True, "min_value": 0, "max_value": 50},
                {"field_key": "climbs", "label": "Climbs", "field_type": "checkbox", "required": True},
                {"field_key": "notes", "label": "Notes", "field_type": "long_text", "required": False},
                {"field_key": "auto", "label": "Auto", "field_type": "multi_select", "required": False,
                 "options": ["Leave", "Balance"]},
            ],
        },
        headers=headers,
    )
    assert resp.status_code == 201, resp.get_json()
    return resp.get_json()["id"]
