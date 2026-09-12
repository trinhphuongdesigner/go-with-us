# Personal development roadmaps (v2)

Canonical prefix: `/api/v2/development-plans`. Every endpoint requires an authenticated
actor with `roadmap:self` and a company. All storage queries bind both owner and company;
administrators cannot access somebody else's roadmap through this self-only API.

The structured milestone/task tree is canonical. `WORK` and `PERSONAL` are the only
categories, required on saves; an unsupported category returns 422. A draft is local
until explicit Save. No generation endpoint, invented AI result, or automatic save is
introduced. AI proposal generation remains separate future integration work.

## Requests and responses

- `GET /me`: `{settings: SettingsRead}`. Reading an empty account does not create rows.
- `GET /me/roadmaps?category=WORK|PERSONAL`: `RoadmapRead[]`, newest first; without a
  category returns both. Each save creates an additional attempt; no previous tree is replaced.
- `POST /me/roadmaps`: 201 `RoadmapRead`. Required body: `clientRequestId` (UUID),
  `category`, `title`, `milestones`. Optional `durationWeeks` (1–520), `hoursPerWeek` (1–168).
  Each milestone has `title`, optional `description`, optional `dueDate` (`YYYY-MM-DD`),
  and `tasks`; each task has `title` and optional `metric`. Supply 1–30 milestones and
  1–50 tasks per milestone. Titles must contain non-whitespace characters (180 max).
  Submitted array positions become persisted zero-based `order`; all tasks start undone.
  Unknown fields (including owner, company, completion, settings and AI claims) are rejected.
- `PATCH /me/roadmaps/{roadmapId}/tasks/{taskId}`: `{expectedVersion: integer >= 1,
  done: boolean}` → full `RoadmapRead`, version incremented. IDs must belong to the same
  roadmap, caller and company; mismatches return 404. Completion is derived from tasks.
- `PATCH /me/settings`: `{expectedVersion: integer >= 0, ...displayFields}` → `SettingsRead`.
  At least one display field is required, null values rejected. The initial version is 0,
  and first explicit preference save creates version 1. Settings updates do not alter
  any roadmap, task, completion, roadmap version, or content timestamp.

`SettingsRead`: `{character: string, viewMode: "stair"|"diagram", costumeColor: "#RRGGBB",
reduceMotion: boolean, fontSize: "sm"|"md"|"lg", version: integer}`. Defaults are `milo`,
`stair`, `#6366f1`, `false`, `md`, and `0`. Character names are bounded to 40 nonblank
characters; the UI chooses which visual assets it supports.

`RoadmapRead`: `{id, category, title, durationWeeks, hoursPerWeek, version, createdAt,
updatedAt, completedTasks, totalTasks, progress, milestones}`. `progress` is the nearest
integer percentage of completed tasks. Milestones contain `{id,title,description,dueDate,
order,status,completedTasks,totalTasks,tasks}`. Tasks contain `{id,title,metric,done,order}`.
Status is `NOT_STARTED`, `IN_PROGRESS`, or `DONE`, computed from current task completion.
Optional response values are null. Dates and timestamps serialize as ISO strings.

Stale updates return `409 {detail:{code:"version_conflict",currentVersion: integer}}`;
the client must reload and let the user apply their choice against the fresh version.
Version comparison and mutation use an atomic database conditional update.

Save retries with the same `clientRequestId` and normalized payload return the existing
attempt (201, possibly with more recent completion); a different payload using the same
key returns `409 {detail:{code:"idempotency_conflict",message: string}}`. The database
unique constraint also handles concurrent save retries. Use a fresh key for a deliberately
new attempt, and retain the key when retrying an uncertain network result.

## Upstream mapping and intentional limits

Reference: `origin/master:backend/src/modules/development-plans/development-plans.service.ts`,
its controller and DTOs, and `origin/master:backend/prisma/schema.prisma`.
Preserved: self-only scope, explicit reviewed save, multiple saved attempts, milestone/task
order, task-derived completion, duration/hours and independent display settings.
Strengthened: tenant composite foreign keys, strict WORK/PERSONAL contract, atomic version
checks, request retry deduplication, bounded validation, and transactional nested saves.

Legacy markdown plan/version history and standalone goal CRUD are not ported into this
slice, and no legacy data is imported or deleted. The upstream implicit side effect that
logs the final milestone as an `aiSuggested` goal is omitted because manual drafts are
not AI-generated. Independently adding/editing/deleting milestone/task content after save
is also outside this bounded API; users can save another reviewed attempt. Existing
attempt completion remains editable.

Migration `0010_development_plans` follows `0009_role_hierarchy`. It creates four tables
and never seeds demo or user data. Models must be imported at application/Alembic startup
so their metadata is registered. Downgrade is blocked to avoid deleting saved plans.
