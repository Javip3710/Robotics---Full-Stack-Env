"""Database models."""

from datetime import datetime, timezone

from backend import db


def utcnow():
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = db.Column(
        db.DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )


class User(db.Model, TimestampMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), nullable=False, unique=True, index=True)
    name = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="member")  # mentor/captain/lead/member
    status = db.Column(db.String(20), nullable=False, default="pending")  # pending/approved/suspended

    def to_dict(self, include_private=False):
        data = {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "status": self.status,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }
        # Email is private: only included in the internal member directory
        # (which itself requires an approved member), never in public output.
        if include_private:
            data["email"] = self.email
        return data


class NewsPost(db.Model, TimestampMixin):
    __tablename__ = "news_posts"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    summary = db.Column(db.String(500), nullable=False, default="")
    body = db.Column(db.Text, nullable=False, default="")
    # Nullable: posts are kept (author unlinked) when a member is deleted.
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    published = db.Column(db.Boolean, nullable=False, default=False)
    published_at = db.Column(db.DateTime(timezone=True), nullable=True)
    featured = db.Column(db.Boolean, nullable=False, default=False)

    author = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "summary": self.summary,
            "body": self.body,
            "author": self.author.name if self.author else None,
            "author_id": self.author_id,
            "published": self.published,
            "published_at": iso(self.published_at),
            "featured": self.featured,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }


class Document(db.Model, TimestampMixin):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    slug = db.Column(db.String(160), nullable=False, unique=True, index=True)
    title = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(80), nullable=False, default="General")
    body = db.Column(db.Text, nullable=False, default="")  # plain text / lightweight Markdown
    visibility = db.Column(db.String(20), nullable=False, default="public")  # public/internal
    updated_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "slug": self.slug,
            "title": self.title,
            "category": self.category,
            "body": self.body,
            "visibility": self.visibility,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }


class Event(db.Model, TimestampMixin):
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    event_date = db.Column(db.Date, nullable=False)
    location = db.Column(db.String(200), nullable=False, default="")
    description = db.Column(db.Text, nullable=False, default="")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "date": self.event_date.isoformat() if self.event_date else None,
            "location": self.location,
            "description": self.description,
        }


class ScoutingTemplate(db.Model, TimestampMixin):
    __tablename__ = "scouting_templates"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False, default="")
    season = db.Column(db.String(80), nullable=False, default="")
    status = db.Column(db.String(20), nullable=False, default="draft")  # draft/active/archived
    current_version = db.Column(db.Integer, nullable=False, default=1)

    def to_dict(self, include_fields=True):
        data = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "season": self.season,
            "status": self.status,
            "version": self.current_version,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }
        if include_fields:
            data["fields"] = [f.to_dict() for f in self.ordered_fields()]
        return data

    def ordered_fields(self):
        return sorted(self.fields, key=lambda f: f.position)


class ScoutingField(db.Model, TimestampMixin):
    __tablename__ = "scouting_fields"

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey("scouting_templates.id"), nullable=False)
    field_key = db.Column(db.String(80), nullable=False)  # stable ID used to key answers
    label = db.Column(db.String(200), nullable=False)
    field_type = db.Column(db.String(20), nullable=False)
    # short_text / long_text / number / checkbox / single_select / multi_select
    required = db.Column(db.Boolean, nullable=False, default=False)
    help_text = db.Column(db.String(500), nullable=False, default="")
    options = db.Column(db.JSON, nullable=True)  # for select fields: ["A", "B"]
    min_value = db.Column(db.Float, nullable=True)  # numeric bounds
    max_value = db.Column(db.Float, nullable=True)
    position = db.Column(db.Integer, nullable=False, default=0)

    template = db.relationship("ScoutingTemplate", backref="fields")

    def to_dict(self):
        return {
            "field_key": self.field_key,
            "label": self.label,
            "field_type": self.field_type,
            "required": self.required,
            "help_text": self.help_text,
            "options": self.options or [],
            "min_value": self.min_value,
            "max_value": self.max_value,
            "position": self.position,
        }


class ScoutingTemplateVersion(db.Model):
    """Immutable snapshot of a template's fields. Submissions reference a
    specific version so they stay readable after the template changes."""

    __tablename__ = "scouting_template_versions"

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey("scouting_templates.id"), nullable=False)
    version = db.Column(db.Integer, nullable=False)
    fields = db.Column(db.JSON, nullable=False)  # list of field definition dicts
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    __table_args__ = (db.UniqueConstraint("template_id", "version"),)


class ScoutingSubmission(db.Model, TimestampMixin):
    __tablename__ = "scouting_submissions"

    id = db.Column(db.Integer, primary_key=True)
    event_name = db.Column(db.String(200), nullable=False)
    team_number = db.Column(db.Integer, nullable=False)
    match_key = db.Column(db.String(80), nullable=True)  # e.g. "qm12"
    template_id = db.Column(db.Integer, db.ForeignKey("scouting_templates.id"), nullable=False)
    template_version = db.Column(db.Integer, nullable=False)
    answers = db.Column(db.JSON, nullable=False)  # {field_key: value}
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)  # set by backend; unlinked if the author is deleted

    author = db.relationship("User")
    template = db.relationship("ScoutingTemplate")

    def to_dict(self, include_answers=True):
        data = {
            "id": self.id,
            "event_name": self.event_name,
            "team_number": self.team_number,
            "match_key": self.match_key,
            "template_id": self.template_id,
            "template_name": self.template.name if self.template else None,
            "template_version": self.template_version,
            "author": self.author.name if self.author else None,
            "author_id": self.author_id,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }
        if include_answers:
            data["answers"] = self.answers
        return data


class InventoryItem(db.Model, TimestampMixin):
    __tablename__ = "inventory_items"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    category = db.Column(db.String(80), nullable=False, default="General")
    quantity = db.Column(db.Float, nullable=False, default=0)
    unit = db.Column(db.String(40), nullable=False, default="each")
    location = db.Column(db.String(160), nullable=False, default="")
    part_number = db.Column(db.String(120), nullable=True)
    notes = db.Column(db.Text, nullable=False, default="")
    low_stock_threshold = db.Column(db.Float, nullable=True)
    archived = db.Column(db.Boolean, nullable=False, default=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "quantity": self.quantity,
            "unit": self.unit,
            "location": self.location,
            "part_number": self.part_number,
            "notes": self.notes,
            "low_stock_threshold": self.low_stock_threshold,
            "archived": self.archived,
            "low_stock": bool(
                self.low_stock_threshold is not None
                and self.quantity <= self.low_stock_threshold
            ),
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }


class InventoryAdjustment(db.Model):
    __tablename__ = "inventory_adjustments"

    id = db.Column(db.Integer, primary_key=True)
    item_id = db.Column(db.Integer, db.ForeignKey("inventory_items.id"), nullable=False)
    quantity_change = db.Column(db.Float, nullable=False)
    reason = db.Column(db.String(500), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)  # kept (unlinked) when a member is deleted
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=utcnow)

    item = db.relationship("InventoryItem")
    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "item_id": self.item_id,
            "item_name": self.item.name if self.item else None,
            "quantity_change": self.quantity_change,
            "reason": self.reason,
            "user": self.user.name if self.user else None,
            "created_at": iso(self.created_at),
        }


def iso(dt):
    return dt.isoformat() if dt is not None else None
