# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**STORE** is a multi-tenant smart ERP platform for businesses running multiple food/retail stores. It consists of three integrated applications:

1. **Backend** (FastAPI + MongoDB) — business logic, data layer, API contracts
2. **Frontend** (React + TypeScript + Vite) — web dashboard for business operations
3. **Mobile** (React Native + Expo) — worker app for field operations (inventory, clock-in, sales recording)
4. **AI Integration** (Module 4) — chat-based assistant using backend services

**Key architectural principle:** Backend is the source of truth. Frontend and mobile consume backend APIs under `/api/v1/...`. All multi-tenant scoping is enforced via `businessId` in backend data access.

---

## Quick Start Commands

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/macOS: use this
# .venv\Scripts\activate  # Windows only

python -m pip install --upgrade pip
pip install -r requirements.txt
```

**Redis is required to run the backend**, not just for caching — the real-time cross-app data sync feature (mobile/frontend live updates over `/api/v1/ws`) uses Redis Pub/Sub for fan-out and the app fails to start without a reachable `REDIS_URL`. Start a local Redis before `uvicorn`:
```bash
docker run -p 6379:6379 redis   # or: redis-server (if installed locally)
```
`REDIS_URL` defaults to `redis://localhost:6379/0` in `backend/.env` — see `specs/001-realtime-data-sync/quickstart.md` for the full sync-feature validation guide.

### Backend: Run & Test
```bash
# Start dev server (auto-reload on code changes)
uvicorn app.main:app --reload --port 8000

# Verify MongoDB connection
python tests/mongocheck.py

# Run workload check
python tests/workload_check.py

# Run pytest (if test suite exists)
pytest tests/
```

**Key endpoints:**
- Health: `http://localhost:8000/api/v1/health`
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Frontend Setup & Run
```bash
cd frontend
npm install
npm run dev    # Start dev server on http://localhost:5173
npm run check  # TypeScript type check
npm run build  # Production build
```

### Mobile Setup & Run
```bash
cd mobile
npm install
npm run start  # Launch Expo Dev Tools
npm run android  # Build for Android simulator
npm run ios      # Build for iOS simulator
npm run web      # Run in browser via Expo Web
npm run check    # TypeScript type check
```

---

## Backend Architecture

### Layering Rule
```
api/ (routes) → services/ (business logic) → repositories/ (data access) → database/ (MongoDB)
```

**Enforce this strictly:**
- **api/** routes should be thin; delegate all business logic to services
- **services/** contain all domain logic; call repositories for data access (never call database driver directly)
- **repositories/** only handle data queries and mutations; no business logic
- **database/** contains MongoDB connection lifecycle and utility functions

### Core Modules

| Module | Purpose | Key Files |
|--------|---------|-----------|
| `app/api/` | FastAPI route handlers (one router per feature) | `auth.py`, `users.py`, `stores.py`, `inventory.py`, `recipes.py`, `sales.py`, `analytics.py`, `ai.py`, etc. |
| `app/models/` | MongoDB document models (Pydantic v2) | One file per collection (`user.py`, `store.py`, `ingredient.py`, `recipe.py`, `sale.py`, `attendance.py`, `ticket.py`, etc.) |
| `app/schemas/` | Request/response Pydantic models (API contracts) | `auth.py`, `user.py`, `store.py`, `recipe.py`, `sale.py`, `ticket.py` |
| `app/services/` | Business logic layer | `inventory_service.py`, `sales_service.py`, `recipe_service.py`, `analytics_service.py`, `ai_service.py`, `attendance_service.py`, etc. |
| `app/repositories/` | Database access layer | `inventory_repository.py`, `user_repository.py`, `sales_repository.py`, `store_repository.py` |
| `app/core/` | Config, security, exceptions, response envelopes | `config.py`, `exceptions.py`, `response.py`, `security.py` |
| `app/database/` | MongoDB client, connection management | `client.py` |
| `app/middleware/` | Auth middleware, businessId injection, logging, error handling | |
| `app/dependencies/` | FastAPI Depends() for current_user, current_business, RBAC guards | |
| `app/ai/` | AI assistant implementation (Module 4) | Tool definitions, conversation persistence |

### Multi-Tenancy Rule
**Never write a query that omits `businessId` filtering** (except super-admin tooling). Every data access must scope by tenant:
```python
# ✓ Correct: filters by businessId
db.users.find_one({"businessId": business_id, "email": email})

# ✗ Wrong: omits businessId scoping
db.users.find_one({"email": email})
```

### Database Name
- Development/staging: `store_erp`
- See `.env` for current MongoDB connection string

### Tech Stack (Locked)
- **Language:** Python 3.13
- **Framework:** FastAPI
- **DB Driver:** Motor (async PyMongo) — not sync PyMongo, not MongoEngine
- **Validation:** Pydantic v2
- **Auth:** JWT (access + refresh tokens)
- **Database:** MongoDB Atlas
- **Caching:** Redis
- **Background Jobs:** APScheduler (or Celery if task volume demands it)

---

## Frontend Architecture

### Tech Stack
- **React 18** + **TypeScript** + **Vite**
- **React Router v7** for client-side routing
- **React Query (TanStack)** for server state management
- **react-hook-form** + **Zod** for form validation and submission
- **Tailwind CSS** for styling
- **Recharts** for charts and analytics
- **Sonner** for toast notifications
- **Axios** for HTTP calls to backend

### Folder Structure
```
src/
├── features/          # Feature-specific components and logic (18 feature folders)
├── components/        # Shared, reusable UI components
├── api/              # API client setup and endpoints
├── hooks/            # Custom React hooks
├── context/          # React context for global state
├── pages/            # Page-level wrappers (if using file-based routing concept)
├── routes/           # Route definitions
├── types/            # TypeScript types
├── lib/              # Utility functions
├── main.tsx          # React entry point
└── index.css         # Global styles
```

### Key Patterns
1. **API calls:** Use React Query (`useQuery`, `useMutation`) for data fetching and caching
2. **Form validation:** Use `react-hook-form` + Zod for validation and error display
3. **State:** Prefer React Query for server state; use Context for UI state (auth, notifications)
4. **Styling:** Tailwind CSS with utility classes; avoid inline styles
5. **Type safety:** All components and API calls should be TypeScript-first

### API Integration
- Base URL is configurable (see `src/api/`)
- All routes assume `/api/v1/` prefix (matches backend)
- Always use React Query for data fetching to enable caching, refetching, and optimistic updates

---

## Mobile App Architecture

### Tech Stack
- **React Native 0.81.5** (via Expo 54)
- **React Navigation** for screen navigation (stack, bottom-tabs)
- **React Query** for server state management
- **expo-sqlite** for offline queue (optimistic updates)
- **expo-secure-store** for token storage
- **React Native NetInfo** for connectivity detection
- **Zod** for form/data validation
- **Lucide React Native** for icons

### Folder Structure
```
src/
├── AppRoot.tsx         # Main navigation shell, session init
├── screens/            # Screen components (worker-focused: clock-in, inventory, sales, etc.)
├── components/         # Shared UI components
├── api/               # API client, endpoints
├── context/           # Auth context, app state
├── db/                # SQLite offline queue and persistence
├── hooks/             # Custom hooks
├── navigation/        # React Navigation setup
├── types/             # TypeScript types
└── lib/               # Utility functions
```

### Key Patterns
1. **Offline-first:** Use `expo-sqlite` to queue operations (sales, inventory) and sync on reconnect
2. **Token storage:** Use `expo-secure-store` for JWT tokens (never AsyncStorage)
3. **Connectivity:** Use NetInfo to detect online/offline and adjust UX
4. **Navigation:** Keep navigation state in top-level context to persist across app lifecycle
5. **Forms:** Use Zod + react-hook-form (same as frontend)

### Worker App Capabilities
- Login/logout with token-based sessions
- Clock in/out for attendance
- Inventory allocation and returns
- Offline sale recording with sync on reconnect
- Read-only recipe viewing
- Ticket submission
- Profile and notification screens

---

## API Contract & OpenAPI

The backend exports an OpenAPI schema to `docs/openapi.json`. This is the single source of truth for:
- All route signatures (method, path, query params)
- All request/response payloads
- All error codes

**Frontend and mobile must treat this schema as authoritative.** If you change a backend route or payload structure, regenerate the schema and update frontend/mobile accordingly.

---

## Development Workflow

### Adding a New Feature (Backend)

1. **Define API contract** in the appropriate route file under `app/api/`
   - Use clear endpoint paths under `/api/v1/{feature}/...`
   - Document request/response schemas using Pydantic

2. **Create data models** in `app/models/` if adding new collections
   - One model per MongoDB collection
   - Use Pydantic v2 with `model_config = ConfigDict(from_attributes=True)`

3. **Create request/response schemas** in `app/schemas/`
   - Keep models and schemas separate (models = DB, schemas = API)

4. **Implement repository methods** in `app/repositories/`
   - Handle all MongoDB queries here
   - **Always filter by `businessId`**
   - Keep transactions/bulk ops here

5. **Implement service methods** in `app/services/`
   - Orchestrate repositories and business logic
   - No direct DB calls
   - Raise `AppException` for domain errors

6. **Connect in route handler** (`app/api/`)
   - Inject service and dependencies (current_user, current_business)
   - Call service methods
   - Return response schemas

7. **Regenerate OpenAPI schema**
   - Backend startup exports schema to `docs/openapi.json`
   - Commit this file so frontend/mobile see updates

### Adding a New Feature (Frontend/Mobile)

1. **Verify backend API contract** in `docs/openapi.json`
2. **Create API client hooks** using React Query
3. **Build UI components** and wire up data fetching
4. **Add form validation** with Zod + react-hook-form
5. **Test with backend running** (start backend before frontend/mobile dev servers)

---

## Testing & Validation

### Backend
```bash
# Check MongoDB connectivity
cd backend && python tests/mongocheck.py

# Run workload simulation
python tests/workload_check.py

# Run pytest suite
pytest tests/
pytest tests/test_auth.py -v  # Single test file
pytest -k "test_login" -v     # Single test by name
```

### Frontend
```bash
cd frontend
npm run check  # Type check only; no runtime tests
npm run build  # Check that build succeeds
```

### Mobile
```bash
cd mobile
npm run check  # Type check only
# No automated tests; manual QA on device/simulator
```

### Manual Smoke Tests
1. Start MongoDB and Redis
2. Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`
3. Visit `http://localhost:8000/docs` → test endpoints interactively
4. Start frontend: `cd frontend && npm run dev`
5. Log in and navigate dashboard
6. Start mobile: `cd mobile && npm run start` → open in Expo Go
7. Verify clock-in, inventory, and offline sync work

---

## Important Constraints & Patterns

### 1. Multi-Tenancy
- Every MongoDB query in repositories must include `{"businessId": business_id}` filter
- RBAC is enforced via role checking in `app/dependencies/` (don't bypass this)
- User sessions are tied to a business; switching businesses requires new token

### 2. Error Handling
- Raise `AppException(status_code, code, message, details=...)` in services
- Backend catches these in `app/main.py` and returns structured error responses
- Never return raw exceptions to clients

### 3. Response Format
- All responses use `success_payload()` or `error_payload()` from `app/core/response.py`
- Frontend expects all responses to follow this envelope structure

### 4. Database Driver
- **Always use Motor** (async MongoDB driver), not sync PyMongo
- Never block the event loop with synchronous DB calls
- All DB methods must be `async`

### 5. JWT Tokens
- Access tokens: short-lived (15-30 min)
- Refresh tokens: long-lived (7+ days)
- Mobile and frontend should store refresh token in secure storage and use access token for API calls

### 6. API Versioning
- All routes under `/api/v1/...`
- If breaking changes needed, create `/api/v2/...` and deprecate v1 gradually

### 7. Module Specifications (Source of Truth)
- **MODULE_1_BACKEND.md** — backend spec, do not rename fields/endpoints
- **MODULE_2_WEB_DASHBOARD.md** — frontend spec and feature list
- **MODULE_3_MOBILE_APP.md** — mobile spec and worker capabilities
- **MODULE_4_AI_INTEGRATION.md** — AI assistant design and tool definitions

**Do not deviate from these specs without flagging the change first.**

---

## Environment Variables

### Backend (`backend/.env`)
```env
APP_ENV=development
MONGO_URI=<MongoDB Atlas connection string>
MONGO_DB_NAME=store_erp
JWT_SECRET=<strong-secret>
JWT_REFRESH_SECRET=<different-strong-secret>
REDIS_URL=redis://localhost:6379/0
OPENROUTER_API_KEY=<for AI module>
APP_CORS_ORIGINS=http://localhost:5173,http://localhost:19006
AI_STREAMING_ENABLED=true
```

### Frontend
- Backend URL is typically `http://localhost:8000` in dev
- Configure in `src/api/client.ts` or similar

### Mobile
- Backend URL is typically `http://10.0.2.2:8000` (Android emulator) or `http://localhost:8000` (physical device on same network)
- Configure in `src/api/client.ts`

---

## Common Development Tasks

### Run Backend Locally
```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

### Run Frontend Locally
```bash
cd frontend
npm run dev
# Opens on http://localhost:5173
```

### Run Mobile Locally
```bash
cd mobile
npm run start
# Scan QR with Expo Go app on device or open in simulator
```

### Check Frontend/Mobile TypeScript
```bash
cd frontend && npm run check   # or
cd mobile && npm run check
```

### Regenerate OpenAPI Schema
The backend automatically exports the schema on startup to `docs/openapi.json`. Restart the backend after any route changes.

### Verify All Services are Running
```bash
# Health check
curl http://localhost:8000/api/v1/health

# API docs
curl http://localhost:8000/openapi.json
```

---

## Architecture Diagrams & Context

### Data Flow
```
Mobile/Frontend
    ↓
React Query (caching)
    ↓
HTTP (axios)
    ↓
Backend FastAPI routes (/api/v1/...)
    ↓
Services (business logic)
    ↓
Repositories (data access)
    ↓
Motor (async MongoDB driver)
    ↓
MongoDB Atlas (persistent data)
```

### Backend Layering
```
HTTP Request
    ↓
Middleware (auth, businessId injection)
    ↓
Dependency injection (current_user, RBAC)
    ↓
Route handler (validate input)
    ↓
Service (orchestrate logic)
    ↓
Repository (execute queries, scoped by businessId)
    ↓
MongoDB
    ↓
Response envelope (success_payload / error_payload)
    ↓
HTTP Response
```

### Multi-Tenancy Scope
```
Every request → Extract businessId from token
    ↓
Pass to service → Pass to repository
    ↓
Repository adds filter: {"businessId": business_id}
    ↓
MongoDB query scoped to tenant
```

---

## Key Files to Read First

When onboarding to a new area:
1. Read the corresponding **MODULE_N.md** spec
2. Check `app/api/{feature}.py` for route signatures
3. Check `app/services/{feature}_service.py` for business logic
4. Check `app/repositories/{feature}_repository.py` for data access patterns
5. Check test files in `tests/` for usage examples

---

## Common Gotchas

1. **Mixing sync and async:** FastAPI is async-first. All DB calls must be `async`. Never use sync PyMongo.
2. **Forgetting businessId:** Every repository query must filter by `businessId`. Missing this breaks multi-tenancy isolation.
3. **Bypassing layers:** Routes should not call repositories or database directly; always go through services.
4. **Changing API contracts:** Always update schema in comments/docstrings and regenerate `docs/openapi.json`.
5. **Token storage in mobile:** Use `expo-secure-store`, never `AsyncStorage`.
6. **Offline sync in mobile:** Check NetInfo before deciding to sync; handle partial failures gracefully.
7. **Type safety in frontend:** Use TypeScript everywhere; generate types from OpenAPI schema if possible.

---

## Useful Commands Cheat Sheet

```bash
# Backend
cd backend && uvicorn app.main:app --reload --port 8000
cd backend && python tests/mongocheck.py
cd backend && python tests/workload_check.py
cd backend && pytest tests/

# Frontend
cd frontend && npm run dev
cd frontend && npm run check
cd frontend && npm run build

# Mobile
cd mobile && npm run start
cd mobile && npm run check
cd mobile && npm run android

# Root (from STORE/)
# (monorepo has no root package.json; manage each package separately)
```

---

## Resources

- **API Schema:** `docs/openapi.json` (auto-generated from FastAPI; regenerated on backend startup)
- **Backend Spec:** `MODULE_1_BACKEND.md`
- **Frontend Spec:** `MODULE_2_WEB_DASHBOARD.md`
- **Mobile Spec:** `MODULE_3_MOBILE_APP.md`
- **AI Spec:** `MODULE_4_AI_INTEGRATION.md`
- **Backend Health:** `http://localhost:8000/api/v1/health`
- **Backend Docs:** `http://localhost:8000/docs` (Swagger UI)
- **Backend ReDoc:** `http://localhost:8000/redoc`
