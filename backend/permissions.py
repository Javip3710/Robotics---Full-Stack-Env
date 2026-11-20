"""Central permission rules.

Roles and membership status are separate concepts:
  roles:    mentor, captain, lead, member
  statuses: pending, approved, suspended

Permissions are NOT a numeric rank. Every action maps to an explicit rule.

Two kinds of rules exist:

1. REQUIRED rules (fixed by the project specification):
   - Public home page, about, and public documentation: anonymous access.
   - Scouting submissions (create/view own): approved members only.
   - Inventory pages and API operations: approved mentors and captains only.
   - Pending/suspended users: no protected team-management access.

2. PROVISIONAL rules (the spec leaves these open; conservative defaults are
   used until the team confirms them — see docs/PERMISSIONS.md). They are all
   defined in RULES below so they can be changed in one place.
"""

ROLES = ("mentor", "captain", "lead", "member")
STATUSES = ("pending", "approved", "suspended")

# Action -> roles allowed. All actions additionally require status == approved
# (enforced by can()). Anonymous access is handled by routes, not by can().
RULES = {
    # Team management — provisional defaults: mentors and captains.
    "approve_members": ("mentor", "captain"),
    "assign_roles": ("mentor", "captain"),
    # Deleting members is mentors only.
    "delete_members": ("mentor"),
    # Content — leads may publish news 
    "publish_news": ("mentor", "captain", "lead"),
    "manage_events": ("mentor", "captain"),
    "manage_documents": ("mentor", "captain", "lead"),
    # Scouting — viewing results is provisional: any approved member may view
    # results (scouts typically compare notes). CSV export follows the same rule.
    "view_scouting_results": ("mentor", "captain", "lead", "member"),
    "manage_scouting_templates": ("mentor", "captain"),
    "edit_any_scouting_submission": ("mentor", "captain"),
    # Member directory: approved members can view; management actions above.
    "view_member_directory": ("mentor", "captain", "lead", "member"),
}


def can(user, action: str) -> bool:
    """True if this user (must already be an approved member) may perform action."""
    if user is None or user.status != "approved":
        return False
    allowed_roles = RULES.get(action)
    if allowed_roles is None:
        return False
    return user.role in allowed_roles


def can_access_inventory(user) -> bool:
    """REQUIRED rule: approved mentors and captains only."""
    return user is not None and user.status == "approved" and user.role in ("mentor", "captain")


def can_submit_scouting(user) -> bool:
    """REQUIRED rule: approved members only."""
    return user is not None and user.status == "approved"
