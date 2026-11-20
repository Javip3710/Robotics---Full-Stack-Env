"""Tests for lead news publishing, rich-text sanitization, image uploads,
and mentor-only member deletion."""

import io

from tests.conftest import auth


# --- News publishing -----------------------------------------------------------


def test_lead_can_create_news(client):
    resp = client.post(
        "/api/news",
        json={"title": "Lead Update", "summary": "summary text", "body": "body text", "published": True},
        headers=auth(client, "lead"),
    )
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()["post"]["published"] is True


def test_news_body_is_sanitized_server_side(client):
    resp = client.post(
        "/api/news",
        json={
            "title": "Tricky Title",
            "summary": "summary text",
            "body": (
                "<p onclick='evil()'>Hello</p>"
                "<script>alert('xss')</script>"
                "<img src='/api/uploads/x.png' onerror='evil()'>"
                "<iframe src='https://evil.example'></iframe>"
            ),
            "published": True,
        },
        headers=auth(client, "mentor"),
    )
    assert resp.status_code == 201, resp.get_json()
    body = resp.get_json()["post"]["body"]
    assert "script" not in body
    assert "onclick" not in body
    assert "onerror" not in body
    assert "iframe" not in body
    assert "evil.example" not in body
    # Allowed markup survives.
    assert "<p>Hello</p>" in body
    assert "<img src=\"/api/uploads/x.png\">" in body


# --- Image uploads --------------------------------------------------------------


def test_upload_requires_news_permission(client):
    # Anonymous and regular members cannot upload.
    assert client.post("/api/uploads").status_code == 401
    resp = client.post("/api/uploads", headers=auth(client, "member"))
    assert resp.status_code == 403

    # Leads may upload.
    data = {"file": (io.BytesIO(b"\x89PNG\r\n\x1a\nfakepng"), "photo.png")}
    resp = client.post("/api/uploads", data=data, content_type="multipart/form-data", headers=auth(client, "lead"))
    assert resp.status_code == 201, resp.get_json()
    payload = resp.get_json()
    assert payload["url"].startswith("/api/uploads/")

    # The stored image is publicly viewable (news images are public content).
    resp = client.get(payload["url"])
    assert resp.status_code == 200


def test_upload_rejects_non_images_and_oversize(client):
    headers = auth(client, "mentor")
    resp = client.post(
        "/api/uploads",
        data={"file": (io.BytesIO(b"not an image"), "virus.exe")},
        content_type="multipart/form-data",
        headers=headers,
    )
    assert resp.status_code == 422

    resp = client.post(
        "/api/uploads",
        data={"file": (io.BytesIO(b"x" * (5 * 1024 * 1024 + 1)), "big.png")},
        content_type="multipart/form-data",
        headers=headers,
    )
    assert resp.status_code == 422


def test_upload_serving_rejects_path_traversal(client):
    for bad in ("../application.py", "abcdef", "deadbeef" * 4 + ".php", "x.png"):
        resp = client.get(f"/api/uploads/{bad}")
        assert resp.status_code == 404, bad


# --- Member deletion -------------------------------------------------------------


def test_only_mentors_can_delete_members(client):
    target = client.get("/api/members", headers=auth(client, "mentor")).get_json()["items"]
    member_id = next(m["id"] for m in target if m["role"] == "member" and m["status"] == "approved")

    assert client.delete(f"/api/members/{member_id}").status_code == 401
    assert client.delete(f"/api/members/{member_id}", headers=auth(client, "member")).status_code == 403
    assert client.delete(f"/api/members/{member_id}", headers=auth(client, "captain")).status_code == 403

    resp = client.delete(f"/api/members/{member_id}", headers=auth(client, "mentor"))
    assert resp.status_code == 200
    assert resp.get_json() == {"ok": True}

    # The member is gone.
    resp = client.get(f"/api/members/{member_id}", headers=auth(client, "mentor"))
    assert resp.status_code == 404


def test_mentor_cannot_delete_themselves(client):
    mentor_id = client.get("/api/members", headers=auth(client, "mentor")).get_json()["items"]
    me = next(m["id"] for m in mentor_id if m["email"] == "mentor@test")
    resp = client.delete(f"/api/members/{me}", headers=auth(client, "mentor"))
    assert resp.status_code == 403


def test_deleted_members_content_survives_unlinked(client):
    from backend import db
    from backend.models import NewsPost, User

    with client.application.app_context():
        author = db.session.query(User).filter_by(role="member").first()
        db.session.add(NewsPost(title="Survivor", summary="s", body="b", author_id=author.id, published=True))
        db.session.commit()
        author_id = author.id

    resp = client.delete(f"/api/members/{author_id}", headers=auth(client, "mentor"))
    assert resp.status_code == 200

    listing = client.get("/api/news").get_json()
    post = next(p for p in listing["items"] if p["title"] == "Survivor")
    assert post["author"] is None
    assert post["author_id"] is None
