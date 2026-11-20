import pytest

from backend import db
from backend.models import User
from tests.conftest import auth


@pytest.mark.parametrize("role", ["mentor", "captain"])
def test_event_lifecycle(client, role):
    headers = auth(client, role)
    response = client.post("/api/events", headers=headers, json={
        "name": "Test event", "date": "2099-05-06",
        "location": "Test location", "description": "Test description",
    })
    assert response.status_code == 201
    event = response.get_json()
    assert event["location"] == "Test location"
    path = f"/api/events/{event['id']}"
    assert event in client.get("/api/events?upcoming=1").get_json()["items"]
    response = client.patch(path, headers=headers, json={
        "name": "Updated event", "date": "2000-01-01",
        "location": "", "description": "Updated description",
    })
    assert response.status_code == 200
    updated = response.get_json()
    assert updated["name"] == "Updated event"
    assert updated["description"] == "Updated description"
    assert updated["location"] == ""
    assert updated in client.get("/api/events").get_json()["items"]
    assert updated not in client.get("/api/events?upcoming=1").get_json()["items"]
    assert client.delete(path, headers=headers).status_code == 200
    assert client.get("/api/events").get_json()["items"] == []
    assert client.patch(path, headers=headers, json={"name": "Absent"}).status_code == 404
    assert client.delete(path, headers=headers).status_code == 404


@pytest.mark.parametrize("role", [None, "lead", "member", "pending", "suspended"])
def test_event_mutations_are_protected(client, role):
    manager = auth(client, "mentor")
    event = client.post("/api/events", headers=manager, json={
        "name": "Protected event", "date": "2099-01-01",
    }).get_json()
    headers = auth(client, role) if role else {}
    expected = 403 if role else 401
    assert client.post("/api/events", headers=headers, json={
        "name": "Not allowed", "date": "2099-01-01",
    }).status_code == expected
    assert client.patch(f"/api/events/{event['id']}", headers=headers, json={"name": "Not allowed"}).status_code == expected
    assert client.delete(f"/api/events/{event['id']}", headers=headers).status_code == expected
    assert client.get("/api/events").get_json()["items"] == [event]


@pytest.mark.parametrize("role,status", [
    ("mentor", "pending"), ("mentor", "suspended"),
    ("captain", "pending"), ("captain", "suspended"),
])
def test_unapproved_privileged_roles_denied(client, role, status):
    headers = auth(client, role)
    with client.application.app_context():
        user = User.query.filter_by(email=f"{role}@test").one()
        user.status = status
        db.session.commit()
    for method, path in [
        (client.post, "/api/events"),
        (client.patch, "/api/events/1"),
        (client.delete, "/api/events/1"),
    ]:
        assert method(path, headers=headers, json={}).status_code == 403


@pytest.mark.parametrize("body", [
    {"name": "ab", "date": "2099-01-01"},
    {"name": "Valid name", "date": "2099-02-30"},
    {"name": 42, "date": 123},
    {"name": "Valid name", "date": "2099-01-01", "location": []},
    {"name": "Valid name", "date": "2099-01-01", "description": {}},
    {"name": "x" * 201, "date": "2099-01-01"},
    ["not an object"],
])
def test_event_validation_is_atomic(client, body):
    headers = auth(client, "captain")
    event = client.post("/api/events", headers=headers, json={
        "name": "Original name", "date": "2099-01-01",
    }).get_json()
    assert client.post("/api/events", headers=headers, json=body).status_code == 422
    assert client.patch(f"/api/events/{event['id']}", headers=headers, json=body).status_code == 422
    assert client.get("/api/events").get_json()["items"] == [event]
