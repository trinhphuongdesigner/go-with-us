# CareerMate — Competency / HR Profile Management Platform

Two-sided platform: **Super Admin** (platform level, no `companyId`) manages
Companies; **Company Admin** (scoped to one `companyId`) manages employee
competency profiles, views an "insight" dashboard for any employee, and
matches employees against a project's required skills (AI-assisted);
**Employee** (single flat tier — peers assess each other, no
sub-hierarchy) tracks own skills/experience, logs life activities,
cross-assesses colleagues, sets development goals, and gets an AI-suggested
personal roadmap. Employees can pick a UI "concept" (default / anime /
film / gather-town-pixel) that reskins their own UI — Admin always stays
on the default look (see "Not yet built" below — this part is schema-only
today).

Built as a sibling project to `D:\Coding\AI_Tool` (Workflow Pro), reusing
its architecture/conventions but with a completely different domain — see
`docs/style-concept.md` for the UI style this was scaffolded from, and
`D:\Coding\AI_Tool\docs\skills.md` for the "AI skill = proposal, never
self-persists" convention this project's AI features follow (Development
Plan generation, Job Requirement candidate matching).

## Structure

Monorepo, two independently-run servers — not one Next.js app with API routes:

- `backend/` — NestJS + Prisma + PostgreSQL, all routes under `/api`, port 3000.
- `frontend/` — Next.js (App Router) + MUI, port 3001.
- `docs/style-concept.md` — the UI style reference (colors, typography,
  shape/elevation, component overrides, interaction conventions) this
  project's `frontend/src/theme/theme.ts` implements. Read before any
  visual/UI work.

**No object storage** — unlike Workflow Pro (DigitalOcean Spaces for long
file content), all content here — including AI-generated Markdown like a
Development Plan — lives directly in Postgres `String`/`Text` columns on
the relevant Prisma model. There is no `StorageService` and no `SPACES_*`
env vars in this codebase; don't introduce one.

## Running locally

```bash
cd backend && npm install && npm run start:dev   # http://localhost:3000/api
cd frontend && npm install && npm run dev         # http://localhost:3001
```

First-time setup (env files, DB migrate + seed) is in the root `README.md`.
Seeded demo logins (password `Password123!` for all): `superadmin@careermate.dev`
(SUPER_ADMIN), `admin@acme.dev` (COMPANY_ADMIN), `alice@acme.dev` /
`bob@acme.dev` / `carol@acme.dev` (EMPLOYEE, at Acme Corp), and
`dana@careermate.dev` (EMPLOYEE, no company — for exercising company-gated
UI like Cross Assessment).

## Data model

Full schema in `backend/prisma/schema.prisma`. Key relationships: `Company`
has many `User`; `User.role` is `SUPER_ADMIN | COMPANY_ADMIN | EMPLOYEE`
(`companyId` is null only for `SUPER_ADMIN`). Per-employee domains all hang
off `User`: `EmployeeSkill` (+ shared `Skill` catalog), `ActivityLog`,
`DevelopmentGoal`, `DevelopmentPlan` (+ `DevelopmentPlanVersion` — versions
**every** save, unlike Workflow Pro's DOCS-only versioning, since a user
only ever has one plan document), `PeerReview` (self-referencing
reviewer/reviewee). `JobRequirement` belongs to a `Company`. `AiProviderConfig`
holds the 3 provider connections (see below).

## AI Settings & the shared AI Chat service

Settings > "API Keys & Connections" (Super Admin only) connects Anthropic,
OpenAI, and/or Gemini — keys encrypted at rest (AES-256-GCM via
`CryptoService`, `ENCRYPTION_KEY` env var), never returned to the client
after saving. **Every AI-assisted feature must go through
`AiChatService`** (`backend/src/modules/ai-chat/`) — it picks the first
connected provider in order Anthropic → OpenAI → Gemini unless a specific
one is requested. No module should call a provider SDK directly.

**AI features are a proposal, never self-persisting** — the same
convention as Workflow Pro's "skills" (`D:\Coding\AI_Tool\docs\skills.md`):
an endpoint calls `AiChatService.send()`, defensively parses the JSON
reply (strip code fences, validate shape, drop any hallucinated id not in
the input set, throw `BadGatewayException` only on a genuinely broken/empty
reply), and returns `{ ...content, summary }` without writing to the DB.
The frontend shows the proposal and only persists on an explicit user
action, via a *separate* endpoint. Two real examples to copy from:
- `POST /api/development-plans/generate` (proposal) → `PUT
  /api/development-plans/me` (explicit save + version snapshot).
- `POST /api/job-requirements/:id/match` — the one exception: this is
  read-only ranked analysis, not a document, so it returns directly with
  no save step at all.

## Where things stand

**Real, backend-backed, all verified (tsc/build/lint clean) as of the last
merge:**
- Auth (login/register-bootstrap/me), Companies (CRUD, Super Admin
  creates a Company + its Company Admin in one call), Users (role-scoped
  CRUD), AI Settings, shared `AiChatService`.
- **Skills & Competency** (`backend/src/modules/skills-competency/`) —
  shared `Skill` catalog (upsert-by-name), employee self-service
  `EmployeeSkill` CRUD, and a Company-Admin "insight" endpoint aggregating
  a given employee's skills + scores + goal/activity/review counts.
  Frontend: `/skills` (self), `/employees` + `/employees/[id]` (Company
  Admin roster + insight view).
- **Activity Log** (`backend/src/modules/activity-logs/`) — owner-scoped
  CRUD, Company Admin/Super Admin can read another same-company user's log.
  Frontend: a tab inside `/profile` (no standalone nav entry — it's part of
  the employee's own profile, not a separate feature).
- **Development Plan & Goals** (`backend/src/modules/development-plans/`)
  — `DevelopmentGoal` CRUD + the AI-assisted roadmap skill (see above).
  Frontend: `/development-plan`.
- **Job Requirements & AI Matching** (`backend/src/modules/job-requirements/`)
  — company-scoped requirement CRUD + AI candidate-matching skill (see
  above). Frontend: `/job-requirements` (linked in `AppShell`'s nav for
  `COMPANY_ADMIN`/`SUPER_ADMIN`).

**CareerMate slice** — scope agreed in `docs/careermate-scope.md` (read it
before touching any of these; it holds the four architectural decisions,
most importantly why the career record must outlive an employment):
- **Competency profile** (`backend/src/modules/competency-profile/`) —
  `Certification`, `ProjectExperience`, `Award` owner-scoped CRUD plus a
  merged-timeline aggregate. Frontend: `/profile` (tabs + timeline).
- **CV/LinkedIn import** (`backend/src/modules/profile-imports/`) — AI
  parses pasted CV text into structured data as a *proposal*
  (`POST /profile-imports/:id/parse`), user picks what to keep, then
  `POST /profile-imports/:id/apply` writes it. Frontend: `/profile/import`.
  No file is ever stored — only extracted text, per the no-object-storage
  rule above.
- **Cross Assessment** (`backend/src/modules/assessments/`) — each company
  builds its own scale (`AssessmentTemplate` → `AssessmentGroup` →
  `AssessmentQuestion`, weighted, scored 1-10), runs monthly
  `AssessmentCycle`s, and an admin approves each `Assessment`. **Approving
  snapshots the whole template onto the record** (`templateSnapshot`) so
  editing the live scale never rewrites approved history. Frontend:
  `/assessments`, `/assessments/[id]`, `/settings/assessment-templates`.
- **Career Passport** (`backend/src/modules/career-passport/`) —
  `Employment` periods are what assessments/projects hang off, so the record
  survives `User.companyId` going null when someone leaves. AI writes a
  `CareerSummary` per period (proposal → explicit save), and
  `CareerPassportShare` issues a revocable token a new employer reads via
  the **unguarded** `GET /api/passport/:token`. Frontend:
  `/career-passport`, `/employees/[id]/passport`, public `/passport/[token]`.
- **AI Assistant** (`backend/src/modules/assistant/`) — one endpoint, two
  audiences: admins get natural-language roster search grounded in the
  company's competency profiles, employees get a companion limited to their
  own record. Frontend: `/assistant`.

**Not yet built (fair game for new work, nothing to migrate away from):**
- **Development roadmap milestones & goal categories** — `DevelopmentMilestone`,
  `DevelopmentTask` and `DevelopmentGoal.category`/`dueDate`/`progress` exist
  in the schema (M6/M7 of `docs/careermate-scope.md`) but
  `backend/src/modules/development-plans/` does not expose them yet and
  `/development-plan` still renders only the markdown plan.
- **Employee UI "concept" switcher** (default/anime/film/gather-town-pixel)
  — `User.themeConcept` exists in the schema and is settable via
  `PATCH /api/users/:id`, but nothing on the frontend reads it yet; the
  theme system (`frontend/src/theme/`) only implements the single default
  style-concept.md look. Building this means: a per-concept theme/asset
  set, a switcher UI (likely on `/profile` or `/settings`), and something
  in `AppShell`/page-level components that picks a theme based on
  `user.themeConcept` when `user.role === 'EMPLOYEE'` — Admin should
  always render the default theme regardless of this field.
- **Cross-cutting AI personal assistant** (floating chat widget for both
  Admin and Employee) — today, AI only shows up per-feature (Development
  Plan generation, Job Requirement matching). A shared assistant would
  reuse the existing `AiChatService` the same way; the natural place to
  mount it is `AppShell.tsx` so it's available on every authenticated page.
- **`/` (Dashboard) and `/profile`** — still the original scaffold's
  "Coming soon" stub pages; no feature slice claimed them.
- Prisma is pinned to `6.19.3` (not the 7.x/8.x betas) because those
  versions drop the classic `datasource { url = env(...) }` schema syntax
  — don't upgrade without checking that migration path first.

## Conventions for new work

- `AppShell` lives in `app/layout.tsx` (persists across navigations). Do
  not wrap individual pages in `AppShell` — that remounts the sidebar.
  Every authenticated page: `PageContainer` + `PageHeader`, content
  inside `Card`s (`frontend/src/components/ui/`) —
  no raw content directly on the page background, per `docs/style-concept.md`
  section 4. Buttons / dialogs / confirm / loading: `Button`, `Dialog`,
  `ConfirmDialog`, `PageSkeleton` in `frontend/src/components/ui/` — see
  `agent.md` §6 Shared UI system. Do not import MUI Button/Dialog directly.
- Every backend route: `JwtAuthGuard` (+ `RolesGuard`/`@Roles(...)` when
  role-restricted), `@CurrentUser()` for the caller's `AuthenticatedUser`
  (`{ id, email, role, companyId }`) — mirror `backend/src/modules/users/`
  for the exact pattern (role-scoped visibility, `class-validator` DTOs).
- Any new typed frontend API module goes in `frontend/src/lib/api/<domain>Api.ts`,
  built on the shared `apiRequest<T>()` in `lib/api/client.ts` — don't grow
  `lib/api/client.ts` or `frontend/src/types/index.ts` into a shared
  bottleneck; keep domain-specific types next to their own `*Api.ts` file.
- New AI features: reuse `AiChatService`, follow the proposal/explicit-save
  split described above — don't let an AI endpoint write to the DB directly.
