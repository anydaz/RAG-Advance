# Multitenant App

A simple multitenant application with 2-step authentication (org name → credentials).

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2, Alembic, psycopg (psycopg3)
- **Frontend**: React 18, Vite, TailwindCSS
- **Database**: PostgreSQL (per-tenant schemas)

## Prerequisites

- [uv](https://docs.astral.sh/uv/) — Python package manager
- Node.js ≥ 18
- PostgreSQL running locally

## Database Setup

```bash
createdb multitenant
```

## Backend

```bash
cd backend

# Install dependencies
uv sync

# Run migrations (creates public.organizations table)
uv run alembic revision --autogenerate -m "initial_schema"
uv run alembic upgrade head

# Seed demo orgs and users
uv run python seed.py

# Start the server (http://localhost:8000)
uv run uvicorn main:app --reload --port 8000
```

### Environment Variables

Copy `.env` and adjust as needed:

| Variable       | Default                                                        | Description          |
|----------------|----------------------------------------------------------------|----------------------|
| `DATABASE_URL` | `postgresql+psycopg://postgres:postgres@localhost:5432/multitenant` | PostgreSQL connection |
| `SECRET_KEY`   | `change-me-in-production-please`                               | JWT signing key      |

## Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev
```

## Demo Credentials

| Org     | Username | Password     |
|---------|----------|--------------|
| `acme`  | alice    | password123  |
| `acme`  | bob      | secret456    |
| `globex`| carol    | globex789    |

## Database Schema

```
public.organizations    ← shared org registry
acme.users              ← isolated per tenant
globex.users            ← isolated per tenant
```

New orgs and users can be created via the admin API:

```bash
# Create org (also provisions tenant schema)
curl -X POST http://localhost:8000/admin/orgs \
  -H "Content-Type: application/json" \
  -d '{"slug": "initech", "display_name": "Initech LLC"}'

# Create user in org
curl -X POST http://localhost:8000/admin/users \
  -H "Content-Type: application/json" \
  -d '{"org_slug": "initech", "username": "peter", "password": "secret"}'
```

## Project Structure

```
├── backend/
│   ├── controllers/        # Route handlers
│   │   ├── auth_controller.py
│   │   └── admin_controller.py
│   ├── services/           # Business logic
│   │   ├── auth_service.py
│   │   └── admin_service.py
│   ├── repositories/       # Database queries
│   │   ├── org_repository.py
│   │   └── user_repository.py
│   ├── migrations/         # Alembic migrations
│   ├── main.py
│   ├── models.py
│   ├── database.py
│   ├── auth.py
│   ├── tenant.py
│   └── pyproject.toml
└── frontend/
    └── src/
        ├── components/     # Reusable components
        │   ├── Button.jsx
        │   └── InputField.jsx
        └── pages/
            ├── login/      # OrgStep, PasswordStep, LoginPage
            └── dashboard/  # DashboardPage
```
