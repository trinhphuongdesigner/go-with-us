# go with us

A competency / HR profile management platform, two sides:

- **Super Admin** (platform level, no `companyId`) — manages Companies
  (create a company + its Company Admin).
- **Company Admin** (scoped to one `companyId`) — manages employees'
  competency profiles, gets an "insight" view of any employee at any time,
  and searches/matches employees against a project's required skills
  (AI-assisted).
- **Employee** (single flat tier — peers can review each other, no
  sub-hierarchy) — updates own experience/competency/skills, logs life
  activities, peer-reviews colleagues, sets personal development goals, and
  gets an AI-suggested development plan. Employees can also pick a UI
  "concept" (default / anime / film / gather-town-pixel) that reskins their
  own UI — the Admin side always stays on the default look.

An AI personal assistant is threaded through both Admin and Employee sides
(helps employees build a roadmap from existing skills; helps admins pick
candidates for a job requirement).

This repo is the **foundation** pass only — schema, shell, auth, and
settings that every feature slice builds on top of. Feature pages beyond
navigable stubs are phase 2.

## Stack

Monorepo, two independently-run servers (not one Next.js app with API
routes):

- `backend/` — NestJS + Prisma + PostgreSQL, all routes prefixed `/api`,
  port 3000.
- `frontend/` — Next.js (App Router) + MUI, port 3001.
- `docs/` — cross-cutting docs.

No object storage — all AI-generated/long text content lives directly in
Postgres `String`/`Text` columns (see `backend/prisma/schema.prisma`).

## Running locally

Both servers must be running at once (separate ports):

```bash
cd backend && npm install && npm run start:dev   # http://localhost:3000/api
cd frontend && npm install && npm run dev         # http://localhost:3001
```

### First-time setup — backend

1. Copy `backend/.env.example` to `backend/.env` and fill in:
   - `DATABASE_URL` — a PostgreSQL connection string.
   - `ENCRYPTION_KEY` — a 32-byte value hex-encoded (64 hex chars). Generate one with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - `JWT_SECRET` — any string for local dev.
2. `npx prisma generate` (already run once during scaffolding, but re-run
   after any schema change).
3. Against a real Postgres database: `npx prisma migrate dev` to create
   tables, then `npm run prisma:seed` to seed demo data (prints login
   credentials for a SUPER_ADMIN, a COMPANY_ADMIN, and a few EMPLOYEEs).

### First-time setup — frontend

1. Copy `frontend/.env.local.example` to `frontend/.env.local` and set
   `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:3000/api`).

## AI Settings

Settings > "API Keys & Connections" (Super Admin only) lets you connect
Anthropic, OpenAI, and/or Gemini — keys are encrypted at rest
(AES-256-GCM) and never returned to the client after saving. Every
AI-assisted feature in the app goes through the shared `AiChatService`
(`backend/src/modules/ai-chat/`), which picks the first connected provider
in order Anthropic → OpenAI → Gemini unless a specific one is requested.

## Where things stand

- **Real, backend-backed:** Auth (login/register-bootstrap/me), Companies
  (CRUD), Users (role-scoped CRUD), AI Settings, and the shared AI Chat
  adapter layer.
- **Stub only (wired into `app.module.ts`, not yet implemented):**
  `skills-competency`, `activity-logs`, `peer-reviews`,
  `development-plans`, `job-requirements` — each has a Prisma model
  already in `schema.prisma` and a placeholder NestJS module/controller
  returning `{ status: 'not-implemented' }`.
- **Frontend stub pages** (`AppShell` + `PageContainer` + `PageHeader` +
  a "Coming soon" `Card`): `/companies`, `/employees`, `/profile`,
  `/skills`, `/activity-log`, `/peer-reviews`, `/development-plan`. `/` is
  a placeholder Dashboard, `/login` and `/settings` are fully real.
