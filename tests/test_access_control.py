"""Access-control acceptance tests.

These verify the security requirements at the API level — i.e. that direct
requests cannot bypass the frontend.
"""

from tests.conftest import auth


def test_anonymous_cannot_access_protected_resources(client):
    for path in (
        "/api/members",
        "/api/scouting/templates",
        "/api/scouting/submissions",
        "/api/inventory/items",
        "/api/inventory/adjustments",
    ):
        resp = client.get(path)
        assert resp.status_code == 401, f"{path} returned {resp.status_code} for anonymous user"
        assert resp.get_json()["error"]["code"] == "unauthenticated"


def test_pending_and_suspended_cannot_submit_scouting(client, template_id):
    for role in ("pending", "suspended"):
        resp = client.post(
            "/api/scouting/submissions",
            json={"event_name": "Regional", "team_number": 1234, "template_id": template_id, "answers": {}},
            headers=auth(client, role),
        )
        assert resp.status_code == 403, f"{role} user should be forbidden, got {resp.status_code}"


def test_approved_member_can_submit_scouting(client, template_id):
    resp = client.post(
        "/api/scouting/submissions",
        json={
            "event_name": "Regional",
            "team_number": 1234,
            "match_key": "qm1",
            "template_id": template_id,
            "answers": {
                "drivetrain": "Swerve",
                "cycles": 5,
                "climbs": True,
                "notes": "looked strong",
                "auto": ["Leave", "Balance"],
            },
        },
        headers=auth(client, "member"),
    )
    assert resp.status_code == 201, resp.get_json()
    data = resp.get_json()
    # Author is assigned by the backend, never taken from the request.
    assert data["author"] == "Member"
    assert data["template_version"] == 1


def test_member_and_lead_cannot_access_inventory(client):
    for role in ("member", "lead"):
        for path in ("/api/inventory/items", "/api/inventory/adjustments"):
            resp = client.get(path, headers=auth(client, role))
            assert resp.status_code == 403, f"{role} got {resp.status_code} on {path}"
        resp = client.post(
            "/api/inventory/items",
            json={"name": "Sneaky", "quantity": 1},
            headers=auth(client, role),
        )
        assert resp.status_code == 403


def test_mentor_and_captain_can_access_inventory(client):
    for role in ("mentor", "captain"):
        resp = client.get("/api/inventory/items", headers=auth(client, role))
        assert resp.status_code == 200, f"{role} got {resp.status_code}"


def test_user_cannot_change_own_role(client):
    headers = auth(client, "captain")
    captain_id = client.get("/api/auth/me", headers=headers).get_json()["user"]["id"]
    resp = client.patch(f"/api/members/{captain_id}", json={"role": "mentor"}, headers=headers)
    assert resp.status_code == 403
    assert "cannot change your own role" in resp.get_json()["error"]["message"]


def test_user_cannot_approve_or_suspend_self(client):
    headers = auth(client, "mentor")
    mentor_id = client.get("/api/auth/me", headers=headers).get_json()["user"]["id"]
    assert client.post(f"/api/members/{mentor_id}/approve", headers=headers).status_code == 403
    assert client.post(f"/api/members/{mentor_id}/suspend", headers=headers).status_code == 403


def test_member_cannot_promote_anyone(client):
    headers = auth(client, "member")
    resp = client.patch("/api/members/1", json={"role": "captain"}, headers=headers)
    assert resp.status_code == 403


def test_crafted_author_id_is_ignored(client, template_id):
    """The submission author comes from the token, never from the payload."""
    headers = auth(client, "member")
    resp = client.post(
        "/api/scouting/submissions",
        json={
            "event_name": "Regional",
            "team_number": 1234,
            "template_id": template_id,
            "author_id": 1,  # crafted: tries to impersonate the mentor
            "answers": {"drivetrain": "Tank", "cycles": 1, "climbs": False},
        },
        headers=headers,
    )
    assert resp.status_code == 201
    assert resp.get_json()["author"] == "Member"  # still the token user


def test_pending_user_cannot_approve_themselves_via_api(client):
    """Pending user with a valid token still cannot reach management endpoints."""
    headers = auth(client, "pending")
    resp = client.post("/api/members/5/approve", headers=headers)
    assert resp.status_code == 403


def test_permission_revoked_mid_session(client):
    """A suspended member's existing token stops working for protected routes."""
    headers = auth(client, "member")
    member_id = client.get("/api/auth/me", headers=headers).get_json()["user"]["id"]
    mentor_headers = auth(client, "mentor")
    client.post(f"/api/members/{member_id}/suspend", headers=mentor_headers)
    resp = client.get("/api/scouting/templates", headers=headers)
    assert resp.status_code == 403


def test_internal_documents_do_not_leak(client):
    from backend import db
    from backend.models import Document

    with client.application.app_context():
        db.session.add(
            Document(
                slug="secret-strategy",
                title="Secret Strategy",
                category="Strategy",
                body="internal only",
                visibility="internal",
            )
        )
        db.session.commit()

    # Anonymous listing: internal docs excluded.
    listing = client.get("/api/documents").get_json()
    assert all(d["slug"] != "secret-strategy" for d in listing["items"])

    # Anonymous direct request: 403, not the content.
    resp = client.get("/api/documents/secret-strategy")
    assert resp.status_code == 403

    # Pending/suspended users also cannot read internal docs.
    resp = client.get("/api/documents/secret-strategy", headers=auth(client, "pending"))
    assert resp.status_code == 403

    # Approved members can.
    resp = client.get("/api/documents/secret-strategy", headers=auth(client, "member"))
    assert resp.status_code == 200


def test_draft_news_stays_private(client):
    from backend import db
    from backend.models import NewsPost, User

    with client.application.app_context():
        author = db.session.query(User).filter_by(role="captain").first()
        db.session.add(NewsPost(title="Draft Title", summary="s", body="b", author_id=author.id, published=False))
        db.session.commit()

    listing = client.get("/api/news").get_json()
    assert all(p["title"] != "Draft Title" for p in listing["items"])

    # Non-manager cannot fetch the draft directly.
    resp = client.get("/api/news?include_drafts=1", headers=auth(client, "member"))
    assert all(p["title"] != "Draft Title" for p in resp.get_json()["items"])

    # Managers can see drafts with the flag.
    resp = client.get("/api/news?include_drafts=1", headers=auth(client, "mentor"))
    assert any(p["title"] == "Draft Title" for p in resp.get_json()["items"])

    # A member cannot sneak drafts without the permission.
    resp = client.get("/api/news", headers=auth(client, "member"))
    assert all(p["published"] for p in resp.get_json()["items"])


def test_member_cannot_create_news(client):
    resp = client.post(
        "/api/news",
        json={"title": "Fake News", "summary": "s", "body": "b", "published": True},
        headers=auth(client, "member"),
    )
    assert resp.status_code == 403
