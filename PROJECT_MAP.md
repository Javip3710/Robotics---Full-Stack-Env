# Project Map — Robo-Nerds Team Portal

A reference map of every branch of this project: what it does, how important it
is, and when you would edit it. Use this to find the right file before making
changes.

Importance legend:

- **CRITICAL** — the app breaks or security holes open if this is wrong. Edit carefully.
- **IMPORTANT** — a feature stops working if broken, but the app still runs.
- **COSMETIC** — safe to change freely; worst case is an ugly page.

---

## Big picture

```
Browser (React app, frontend/dist)
   │  fetch("/api/...")  +  Bearer token header
   ▼
application.py  ──►  Flask app (backend/)
   │                     ├─ security.py      → who are you? (token check)
   │                     ├─ permissions.py   → are you allowed? (role rules)
   │                     ├─ routes/*.py      → what do you want? (endpoints)
   │                     └─ models.py        → read/write the SQLite database
   ▼
instance/frc_portal.db (+ instance/uploads/ for news images)
```

One command runs everything: `python application.py` serves both the API and
the built frontend on port 5000. During frontend development you instead run
`npm run dev` (port 5173), which forwards `/api` calls to port 5000.

Two source trees, never mixed:

- `backend/` — Python/Flask: the real security boundary. Everything enforced
  here is enforced even against crafted API requests.
- `frontend/` — React/TypeScript: the user interface. It hides buttons users
  shouldn't see, but it is NOT the security boundary.

---

## Branch 1: Root files

| File | Importance | What it does / when to edit |
|---|---|---|
| `application.py` | CRITICAL | Entry point. Serves the API and the built frontend (`frontend/dist`) with SPA fallback. CLI: `python application.py [seed\|create-user]`. Edit only to change how the app starts or which port it uses. |
| `requirements.txt` | CRITICAL | Python dependencies. After changing it, run `pip install -r requirements.txt`. |
| `.env.example` | IMPORTANT | Documents the environment variables: `SECRET_KEY` (token signing — set this for anything beyond local use), `DATABASE_URL`, `FLASK_CORS_ORIGINS`, `TOKEN_TTL_SECONDS`. Copy to `.env` when deploying; never commit real secrets. |
| `.gitignore` | COSMETIC | Keeps `node_modules/`, `dist/`, `instance/` (database + uploads), and `.env` out of version control. |

---

## Branch 2: `backend/` (Python — the security boundary)

### `backend/permissions.py` — CRITICAL

The single source of truth for **who may do what**. One `RULES` dict maps each
action → the roles allowed to do it (all actions also require approved status):

```
approve_members, assign_roles   → mentor, captain
delete_members                  → mentor
publish_news                    → mentor, captain, lead
manage_events                   → mentor, captain
manage_documents                → mentor, captain, lead
view_scouting_results           → mentor, captain, lead, member
manage_scouting_templates       → mentor, captain
edit_any_scouting_submission    → mentor, captain
view_member_directory           → mentor, captain, lead, member
```

Plus the fixed rules from the spec: `can_access_inventory()` (mentors +
captains only) and `can_submit_scouting()` (any approved member).

**To change who can do something:** edit `RULES` here — the backend enforces
it immediately. Then mirror the same change in
`frontend/src/auth/permissions.ts` so the UI hides/shows matching controls.

### `backend/security.py` — CRITICAL

Passwords (Werkzeug PBKDF2) and auth tokens (HMAC-signed JWT-style, no
database). Provides the route decorators:

- `login_required` — valid token needed
- `active_required` — token + approved account
- `permission_required("action")` — token + approved + permission rule

Never trust role/status/author fields sent by the browser; routes set the
author from the token. Edit only if you understand token auth.

### `backend/models.py` — CRITICAL

Every database table as a Python class: `User`, `NewsPost`, `Document`,
`Event`, `ScoutingTemplate`, `ScoutingTemplateVersion`, `ScoutingSubmission`,
`InventoryItem`, `InventoryAdjustment`. Each has a `to_dict()` that controls
exactly what the API returns — **emails are only included when
`include_private=True`** (used only by member managers).

Two design points to preserve when editing:

- Submissions store `template_version` and render against an immutable
  `ScoutingTemplateVersion` snapshot, so old data stays readable after a
  template changes.
- `author_id`/`user_id` columns are nullable so deleting a member unlinks
  (keeps) their posts/submissions/history instead of destroying them.

### `backend/__init__.py` — CRITICAL

App factory: config, database, CORS, blueprint registration. Add a new
route file here (register its `bp`), or read env vars here.

### `backend/routes/` — IMPORTANT (one file per feature)

| File | Endpoints | Notes |
|---|---|---|
| `auth.py` | register, login, me | Sets the token; login is rate-limited-ish via hashing cost. |
| `news.py` | list/get/create/update posts | Body is rich text — **sanitized with nh3 on every save** (`ALLOWED_TAGS` / `ALLOWED_ATTRIBUTES` control what HTML survives). Drafts are only visible to publishers. |
| `uploads.py` | upload + serve images | Publishers only; JPG/PNG/GIF/WebP, 5 MB max; files land in `instance/uploads/` with random names. |
| `members.py` | directory, role, approve, suspend, **delete** | Self-service (approve/suspend/re-role/delete yourself) is blocked server-side. Delete = mentors only; unlinks content instead of destroying it. |
| `scouting.py` | templates + submissions | Validates every answer against the template version (type, options, bounds, required). Edit/delete restricted to authors + mentors/captains. |
| `inventory.py` | items + adjustments | Mentors/captains only. Quantity can only change through `/adjust` (reason required, no negative stock), so history stays consistent. Archiving preferred over deleting. |
| `documents.py` | public/internal docs | Internal docs require an approved member; public docs are anonymous. |
| `events.py` | list/create/update/delete events | Public listing; approved mentors and captains can create, edit, and delete. Input is validated before changes are saved. Deleting events preserves scouting history. |

### `backend/seed.py` — COSMETIC (but resets data)

Demo fixtures. **`python application.py seed` wipes the database and reloads
these** — dev tool only. All demo accounts use password `password123`:
`mentor@`, `captain@`, `lead@`, `member@` (approved), `pending@`, `suspended@`
— all `@example.com`. Use `python application.py create-user` for a real
first account instead.

---

## Branch 3: `frontend/` (React + TypeScript + Tailwind)

### `frontend/src/api/` — IMPORTANT (all server communication)

| File | Purpose |
|---|---|
| `client.ts` | The only `fetch` wrapper. Adds the Bearer token, normalizes errors into `ApiError`. |
| `types.ts` | TypeScript shapes of every API response. Keep in sync with `backend/models.py` `to_dict()` outputs. |
| `endpoints.ts` | One function per API endpoint (`newsApi`, `membersApi`, `scoutingApi`, `inventoryApi`, `uploadsApi`, …). |
| `hooks.ts` | TanStack Query hooks (`useNews`, `useMembers`, mutations…). Components use these, never raw endpoints. |

**To talk to a new/changed endpoint:** add/change it in `endpoints.ts`, type it
in `types.ts`, wrap it in `hooks.ts`.

### `frontend/src/auth/` — IMPORTANT

| File | Purpose |
|---|---|
| `AuthContext.tsx` | Holds the signed-in user; token lives in localStorage (`frc_portal_token`). |
| `guards.tsx` | Route guards: `RequireAuth`, `RequireApproved`, `RequirePermission`. |
| `permissions.ts` | **Mirror of `backend/permissions.py`** — UI-only. Keep the two in sync (see Sync points below). |

### `frontend/src/components/` — IMPORTANT / COSMETIC

| File | Purpose |
|---|---|
| `ui.tsx` | Buttons, inputs, cards, badges, tables — the design system. Change look-and-feel here once, it applies everywhere. |
| `TeamLogo.tsx` | Team name/number/wordmark. **Edit this to rename the team anywhere it appears.** |
| `RichTextEditor.tsx` | The news post editor toolbar (bold/headings/lists/links/images). Formatting is done with `document.execCommand`; the backend re-sanitizes everything anyway. |

### `frontend/src/layouts/`

| File | Purpose |
|---|---|
| `PublicLayout.tsx` | Public site chrome: gold header + footer, nav links. |
| `PortalLayout.tsx` | Signed-in sidebar: navy background, nav items filtered by permission, user card, sign out. **Add portal nav entries here.** |

### `frontend/src/pages/` — one file per screen

Public: `Home`, `About`, `SignIn`, `DocsIndex`, `DocDetail`, `NewsDetail`, `NotFound`.
Portal: `Dashboard`, `Members`, `Events` (add/edit/delete events), `ScoutingSubmit`, `ScoutingResults` (+`SubmissionDetail`), `ScoutingTemplates`, `Inventory`, `InventoryItemDetail`, `NewsEditor` (create/edit posts).

**To add a page:** create it in `pages/`, register a `<Route>` in `App.tsx`
(wrap in the right guard), and link to it from a layout or the Dashboard.

### `frontend/src/index.css` — COSMETIC (theme control)

Tailwind v4 theme tokens — **this is where the colors live**:

```
--color-brand-*  → navy scale (brand-600 = #01015F is the primary)
--color-gold-*   → gold scale (gold-400 = #EBB819)
```

Swap palettes by editing these tokens; every `bg-brand-600` / `text-gold-400`
class across the app updates automatically. Also holds `.rich-text` styles
(how news post bodies render) and the editor surface styles.

### Other frontend files

- `App.tsx` — every URL route in one place (CRITICAL for navigation).
- `main.tsx` — bootstrap; rarely touched.
- `vite.config.ts` — build config + the dev proxy `/api` → port 5000.
- `index.html` — page title and root HTML.

---

## Branch 4: `tests/` — IMPORTANT

- `conftest.py` — builds an isolated throwaway DB per test, seeds the six
  role accounts, `auth()` helper for getting tokens.
- `test_access_control.py` — the security spec: anonymous/pending/suspended
  denials, self-service blocks, crafted-request attempts.
- `test_functionality.py` — scouting validation, template versioning,
  inventory consistency.
- `test_news_and_members.py` — lead publishing, HTML sanitization, image
  upload rules, mentor-only deletion.
- `test_events.py` — event creation/editing/deletion, input validation,
  public listing updates, and approved mentor/captain authorization.

Run everything: `python3 -m pytest tests/ -q` (31 tests). **Run this after any
backend change** — it is your safety net.

---

## Sync points — change these together

| If you change… | Also change | Why |
|---|---|---|
| `backend/permissions.py` RULES | `frontend/src/auth/permissions.ts` | Backend enforces, frontend decides what to display. Out of sync = hidden buttons or visible-but-denied actions. |
| `backend/models.py` to_dict() | `frontend/src/api/types.ts` | The API response shape must match the TS types. |
| A route path in `backend/routes/` | `frontend/src/api/endpoints.ts` | Frontend calls the path literally. |
| `requirements.txt` | run `pip install -r requirements.txt` | New deps aren't installed automatically. |
| `frontend/src/index.css` tokens | nothing | Tokens propagate by class name (`brand-600` etc.). |
| Any frontend source | `cd frontend && npm run build` | Port 5000 serves the compiled build, not the source. |

---

## Common edit recipes

**Change the color scheme** → `frontend/src/index.css` `@theme` tokens only.

**Rename the team / change number** → `frontend/src/components/TeamLogo.tsx`
(wordmark + logo), plus the strings in `PublicLayout.tsx` (footer) and
`Home.tsx` (hero).

**Change who can do something** → `backend/permissions.py` RULES + mirror in
`frontend/src/auth/permissions.ts`. Add a test for the new rule.

**Add a news-related feature** → `backend/routes/news.py` (endpoint +
sanitizer allowlist if new HTML tags), then `endpoints.ts` / `types.ts` /
`hooks.ts` / `NewsEditor.tsx`.

**Add a whole new section (e.g. "Media")** → new `backend/routes/media.py`
(register in `backend/__init__.py`), new `frontend/src/pages/Media.tsx`,
route in `App.tsx`, nav link in `PublicLayout.tsx` or `PortalLayout.tsx`.

**Adjust what HTML is allowed in news posts** → `ALLOWED_TAGS` /
`ALLOWED_ATTRIBUTES` in `backend/routes/news.py` (never widen this casually —
it is the XSS defense).

**Change upload limits/types** → `backend/routes/uploads.py`
(`ALLOWED_EXTENSIONS`, `MAX_UPLOAD_BYTES`).

---

## Command reference

```
pip install -r requirements.txt          # after pulling changes
python application.py seed               # reset DB + demo data (destroys data!)
python application.py create-user        # create a real account (interactive)
python application.py                    # run everything at http://127.0.0.1:5000
python3 -m pytest tests/ -q              # run the test suite (31 tests)

cd frontend
npm install                              # after pulling changes
npm run build                            # compile UI for port 5000
npm run dev                              # dev server at :5173 with hot reload
```
