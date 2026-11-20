# Robo-Nerds Robotics — FRC Team 5089

A full-stack robotics team website and management portal combining a public-facing website with member tools for scouting, inventory, events, and team content.

Project still under development. New integrations coming soon.

## Features

### Public website
- Team home and about pages.
- Published news and individual news articles.
- Public documentation.
- Sign-in and account registration.

### Member portal
- Role-based access for mentors, captains, leads, and members.
- Membership approval workflow with pending, approved, and suspended statuses.
- Member directory and account management.
- News editing with rich text and image uploads.
- Public and internal documentation.
- Event management.

### Scouting
- Custom templates with draft, active, and archived states.
- Short text, long text, number, checkbox, single-select, and multi-select fields.
- Required-field validation and numeric bounds.
- Versioned templates to preserve the meaning of older submissions.
- Submission results with event, team, match, and template filters.
- CSV export.
- Submission corrections and deletion subject to permissions.

### Inventory
- Item search and category/location filters.
- Quantities, units, part numbers, storage locations, and low-stock thresholds.
- Stock adjustments with reasons and adjustment history.
- Item archiving that preserves history.
- Access restricted to approved mentors and captains.

## Technology stack

| Layer | Technologies |
| --- | --- |
| Backend | Python, Flask, Flask-SQLAlchemy, SQLAlchemy |
| Database | SQLite by default; configurable SQLAlchemy database URL |
| Frontend | React 18, TypeScript, Vite 6 |
| Styling | Tailwind CSS 4 |
| Routing and data fetching | React Router, TanStack Query |
| Testing | pytest |

## Requirements

- Python with support for the pinned dependencies in `requirements.txt`.
- Node.js and npm compatible with the frontend dependencies; use a current supported Node.js LTS release.
- Git if cloning the repository. Downloading and extracting a ZIP also works.

The commands below assume Windows Command Prompt unless otherwise noted.

## Local setup

### 1. Open the project folder

Clone this repository using its GitHub URL, or download and extract its ZIP. Open a terminal in the project root: the folder containing `application.py`, `requirements.txt`, `backend/`, and `frontend/`.

### 2. Create a Python virtual environment

```bat
python -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
```

On macOS/Linux, activate the environment with:

```sh
source .venv/bin/activate
```

### 3. Set backend configuration

For Windows Command Prompt:

```bat
set SECRET_KEY=replace-with-a-long-random-secret
```

For macOS/Linux:

```sh
export SECRET_KEY="replace-with-a-long-random-secret"
```

Replace the example value with your own random secret. These commands apply to the current terminal session; set the variable again in a new terminal or configure it through your environment manager.

See `.env.example` for available settings. The backend currently reads operating-system environment variables directly; running `python application.py` does not automatically load a `.env` file.

### 4. Create your first account

For a fresh installation without demo content:

```bat
python application.py create-user
```

Follow the prompts to enter an email, name, role, and password. Choose `mentor` to create an initial account with member-management permissions. This helper creates an approved account. Passwords must contain at least eight characters.

The application creates missing database tables when it starts. With the default configuration, SQLite data is stored in `instance/frc_portal.db`.

### 5. Install and build the frontend

```bat
cd frontend
npm ci
npm run build
cd ..
```

### 6. Start the application

```bat
python application.py
```

Open http://127.0.0.1:5000 and sign in with the account you created.

When `frontend/dist/` exists, Flask serves the compiled frontend and API together. Without a frontend build, the root page displays an API-running message instead of the full website.

## Development with hot reload

Use two terminals for frontend development.

### Terminal 1: Flask backend

From the project root, activate your Python environment, set your environment variables, and run:

```bat
.venv\Scripts\activate
set SECRET_KEY=replace-with-your-local-development-secret
python application.py
```

### Terminal 2: Vite frontend

From the project root:

```bat
cd frontend
npm run dev
```

Open http://localhost:5173. Vite is configured to proxy `/api` requests to Flask at http://127.0.0.1:5000, so the default local workflow does not require custom CORS configuration.

Vite updates the frontend as you edit source files. If you use the Flask-served site on port 5000 instead, rebuild with `npm run build` inside `frontend/` after frontend changes.

## Optional demo data

> Warning: the seed command drops and recreates the database tables. It deletes existing application data. Never run it against a database you need to preserve.

For a disposable local demo database only:

```bat
python application.py seed
```

Confirm the reset when prompted. This loads clearly labeled placeholder news, documents, events, scouting data, inventory, and demo accounts.

| Email | Role | Status |
| --- | --- | --- |
| mentor@example.com | Mentor | Approved |
| captain@example.com | Captain | Approved |
| lead@example.com | Lead | Approved |
| member@example.com | Member | Approved |
| pending@example.com | Member | Pending |
| suspended@example.com | Member | Suspended |

All demo accounts use `password123`. These credentials are for local development only. Use `create-user` instead when starting with real team data.

## Roles and permissions

Protected team-management operations require approved membership. Newly registered accounts start as pending members; pending and suspended accounts do not receive protected team-management access.

| Action | Approved roles allowed |
| --- | --- |
| View member directory | Mentor, captain, lead, member |
| Submit scouting, view results, export CSV | Mentor, captain, lead, member |
| Publish news and upload news images | Mentor, captain, lead |
| Manage documentation | Mentor, captain, lead |
| Manage events | Mentor, captain |
| Approve members and assign roles | Mentor, captain |
| Manage scouting templates | Mentor, captain |
| Access inventory | Mentor, captain |
| Delete members | Mentor |

Approved submission authors may edit or delete their own scouting submissions; approved mentors and captains may edit or delete others' submissions.

Permissions are enforced by the backend, not just hidden in the interface. Current defaults allow every approved member to view scouting results and export CSV. Review those rules before using the portal with sensitive information.

## Configuration reference

| Variable | Purpose | Default |
| --- | --- | --- |
| `SECRET_KEY` | Signs authentication tokens; replace the development fallback | `dev-secret-change-me` |
| `DATABASE_URL` | SQLAlchemy database connection URL | `sqlite:///frc_portal.db` |
| `TOKEN_TTL_SECONDS` | Authentication token lifetime in seconds | `43200` (12 hours) |
| `FLASK_CORS_ORIGINS` | Comma-separated allowed origins for cross-origin API requests | Unset |
| `PORT` | Port used by the local Flask entry point | `5000` |
| `VITE_API_BASE_URL` | Optional frontend API base URL | Leave empty for same-origin `/api` requests |

Frontend overrides can be placed in `frontend/.env.local`. Restart Vite after changing frontend environment settings and rebuild for a compiled frontend deployment. Do not place backend secrets in frontend variables.

## Project structure

```text
.
├── application.py          # Flask entry point and local account/demo commands
├── backend/
│   ├── __init__.py         # App factory and database initialization
│   ├── models.py           # Database models
│   ├── permissions.py      # Central role/status permission rules
│   ├── security.py         # Authentication and authorization helpers
│   ├── seed.py             # Destructive development-only demo fixtures
│   └── routes/             # Auth, news, docs, events, members, scouting,
│                           # inventory, and upload API endpoints
├── frontend/
│   ├── src/
│   │   ├── api/            # API client, types, endpoints, and hooks
│   │   ├── auth/           # Frontend auth context and route guards
│   │   ├── components/     # Shared UI, editor, and team branding
│   │   ├── layouts/        # Public website and portal layouts
│   │   └── pages/          # Application pages
│   ├── package.json
│   └── vite.config.ts
├── tests/                  # Backend automated tests
├── .env.example            # Configuration template, not real credentials
├── .gitignore
├── requirements.txt
├── PROJECT_MAP.md          # Codebase navigation and implementation notes
└── HANDOFF.md              # Development handoff notes
```

`instance/`, `frontend/dist/`, `frontend/node_modules/`, and `.venv/` are local runtime/build/dependency directories, not source files to commit.

## Testing

From the project root with the Python environment activated:

```bat
python -m pytest tests/ -q
```

Check TypeScript and build the frontend:

```bat
cd frontend
npm run build
```

## Images and local data

News image uploads accept JPG/JPEG, PNG, GIF, and WebP files up to 5 MiB each. Images are stored in `instance/uploads/` and served publicly, so do not upload private member information or confidential documents as news images.

Back up both the database and uploaded images. GitHub source-code uploads do not back up ignored runtime data in `instance/`.

## Git and secrets

Commit source code, dependency manifests, lockfiles, and `.env.example`. Do not commit real secrets, local databases, virtual environments, installed dependencies, or generated frontend builds.

Ensure `.gitignore` includes these environment-file patterns:

```gitignore
.env
.env.local
.env.*.local
```

Keep `.env.example` tracked only while it contains safe placeholder values. Ignore rules do not remove files that Git already tracks.

## Deployment notes

Uploading the repository to GitHub stores the source code; it does not run the Flask application or host its database.

The included `python application.py` command runs Flask on loopback with debug mode enabled. It is a local development entry point, not a production deployment configuration.

Before public deployment:

- Configure a strong private `SECRET_KEY` and an appropriate database connection.
- Use a production WSGI server and deployment configuration instead of the debug entry point.
- Build the frontend and arrange persistent storage for the database and uploaded images.
- Do not seed a real database or retain public demo credentials in a live installation.
- Review role permissions and cross-origin settings for your team's needs.
- Plan database schema changes separately: `db.create_all()` creates missing tables but is not a versioned migration workflow.
