"""DEVELOPMENT FIXTURES ONLY.

All data created here is fake placeholder content clearly labeled for
development. Never run this against production data — it is intended for a
fresh database so you can explore the app immediately.

Demo accounts (password for all: password123 — development only):
  mentor@example.com   (mentor, approved)
  captain@example.com  (captain, approved)
  lead@example.com     (lead, approved)
  member@example.com   (member, approved)
  pending@example.com  (member, pending)
  suspended@example.com(member, suspended)
"""

import re
from datetime import date, timedelta

from backend import db
from backend.models import (
    Document,
    Event,
    InventoryAdjustment,
    InventoryItem,
    NewsPost,
    ScoutingField,
    ScoutingSubmission,
    ScoutingTemplate,
    ScoutingTemplateVersion,
    User,
)
from backend.security import hash_password

DEMO_PASSWORD = "password123"

def demo():
    db.drop_all()
    db.session.commit()

def seed_demo():
    db.drop_all()
    db.create_all()

    def user(email, name, role, status):
        u = User(
            email=email,
            name=name,
            password_hash=hash_password(DEMO_PASSWORD),
            role=role,
            status=status,
        )
        db.session.add(u)
        return u

    mentor = user("mentor@example.com", "Dana Mentor (demo)", "mentor", "approved")
    captain = user("captain@example.com", "Sam Captain (demo)", "captain", "approved")
    lead = user("lead@example.com", "Riley Lead (demo)", "lead", "approved")
    member = user("member@example.com", "Jordan Member (demo)", "member", "approved")
    user("pending@example.com", "Casey Pending (demo)", "member", "pending")
    user("suspended@example.com", "Avery Suspended (demo)", "member", "suspended")
    db.session.flush()

    today = date.today()

    # Minimal, clearly-labeled placeholder fixtures — no authored team content.
    # They exist only so the features can be exercised; delete them and add real
    # content through the app.
    db.session.add_all(
        [
            NewsPost(
                title="Demo news post (published)",
                summary="Demo fixture — replace with your team's weekly update.",
                body="Demo fixture. This post demonstrates the news feature (title, summary, body, author, date).",
                author_id=captain.id,
                published=True,
                published_at=today - timedelta(days=2),
                featured=True,
            ),
            NewsPost(
                title="Demo draft post (unpublished)",
                summary="Demo fixture — drafts stay private until published.",
                body="Demo fixture. Drafts are only visible to users who can publish news.",
                author_id=mentor.id,
                published=False,
            ),
        ]
    )

    db.session.add_all(
        [
            Event(
                name="Demo event (upcoming)",
                event_date=today + timedelta(days=7),
                location="Demo location",
                description="Demo fixture.",
            ),
            Event(
                name="Demo event (later)",
                event_date=today + timedelta(days=45),
                location="Demo location",
                description="Demo fixture.",
            ),
        ]
    )

    def doc(title, category, body, visibility):
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
        d = Document(
            slug=slug,
            title=title,
            category=category,
            body=body,
            visibility=visibility,
        )
        db.session.add(d)

    doc(
        "Demo public document",
        "Demo",
        "Demo fixture — this public document demonstrates the documentation feature.",
        "public",
    )
    doc(
        "Demo internal document",
        "Demo",
        "Demo fixture — internal documents are only visible to approved members.",
        "internal",
    )

    # --- Scouting: one active demo template demonstrating every field type ---
    template = ScoutingTemplate(
        name="Demo scouting template (all field types)",
        description="Demo fixture — demonstrates each supported field type. Replace with a real template.",
        season="Demo",
        status="active",
        current_version=0,
    )
    db.session.add(template)
    db.session.flush()
    demo_fields = [
        {
            "field_key": "demo_select",
            "label": "Demo single-select field",
            "field_type": "single_select",
            "required": True,
            "help_text": "Demo of a required single-select field.",
            "options": ["Option A", "Option B", "Option C"],
        },
        {
            "field_key": "demo_checkbox",
            "label": "Demo checkbox field",
            "field_type": "checkbox",
            "required": True,
            "help_text": "Demo of a required checkbox field.",
        },
        {
            "field_key": "demo_number",
            "label": "Demo number field",
            "field_type": "number",
            "required": True,
            "help_text": "Demo of a required number field with bounds.",
            "min_value": 0,
            "max_value": 50,
        },
        {
            "field_key": "demo_multi_select",
            "label": "Demo multi-select field",
            "field_type": "multi_select",
            "required": False,
            "help_text": "Demo of an optional multi-select field.",
            "options": ["Choice 1", "Choice 2", "Choice 3"],
        },
        {
            "field_key": "demo_notes",
            "label": "Demo notes field",
            "field_type": "long_text",
            "required": False,
            "help_text": "Demo of an optional long-text field.",
        },
    ]
    for position, f in enumerate(demo_fields):
        db.session.add(
            ScoutingField(
                template_id=template.id,
                field_key=f["field_key"],
                label=f["label"],
                field_type=f["field_type"],
                required=f["required"],
                help_text=f.get("help_text", ""),
                options=f.get("options") or None,
                min_value=f.get("min_value"),
                max_value=f.get("max_value"),
                position=position,
            )
        )
    template.current_version = 1
    db.session.add(
        ScoutingTemplateVersion(template_id=template.id, version=1, fields=demo_fields)
    )
    db.session.flush()

    db.session.add(
        ScoutingSubmission(
            event_name="Demo event",
            team_number=1234,
            match_key=None,
            template_id=template.id,
            template_version=1,
            answers={
                "demo_select": "Option A",
                "demo_checkbox": True,
                "demo_number": 4,
                "demo_multi_select": ["Choice 1", "Choice 3"],
                "demo_notes": "Demo submission — replace with real scouting data.",
            },
            author_id=member.id,
        )
    )

    # --- Inventory (demo) ----------------------------------------------------
    item_a = InventoryItem(
        name="Demo item A",
        category="Demo category",
        quantity=6,
        unit="each",
        location="Demo location",
        part_number="DEMO-001",
        notes="Demo inventory item.",
        low_stock_threshold=4,
    )
    db.session.add(item_a)
    db.session.flush()
    db.session.add(
        InventoryAdjustment(
            item_id=item_a.id, quantity_change=6, reason="Initial stock", user_id=mentor.id
        )
    )
    db.session.add(
        InventoryItem(
            name="Demo item B",
            category="Demo category",
            quantity=12,
            unit="each",
            location="Demo location",
            part_number=None,
            notes="Demo inventory item.",
            low_stock_threshold=8,
        )
    )

    db.session.commit()
    print("Seeded demo fixtures (all content is fake placeholder data).")
    print(f"Demo login: mentor@example.com / {DEMO_PASSWORD} (also captain@, lead@, member@, pending@, suspended@)")
