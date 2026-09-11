# CareerMate v1 — Gap inventory for Wave 1

> Tài liệu này ghi lại hành vi và lỗi đã quan sát trong v1. Nó không phải hợp đồng API
> v2. Những đề xuất cũ như base path `/api` hoặc role BOD/HR không ghi đè kế hoạch
> đã duyệt; hợp đồng chuẩn nằm tại `wave1-feature-contract.md`.

**Baseline verified:** `origin/master` and `.claude/worktrees/v2-integration` both resolve to `48afb1ba4bb916d56cbfc95ac3264ad540587da7` on 2026-09-12. The integration worktree has no `v2/` implementation yet. This document is the executable contract for the Python rewrite; it records accepted v1 behavior and explicitly fixes security, tenant, privacy, and transaction defects found in v1.

## 1. Scope and compatibility decisions

Wave 1 includes authentication, companies, user/employment management needed to establish tenant scope, the aggregate competency profile, skills, projects, certifications, awards, and AI-assisted profile import. Assessment, roadmap, assistant chat, passport sharing, and offboarding are later waves.

- Keep the external base path `/api`; do not introduce `/api/v2` while replacing the server. Existing frontend clients already call these paths (`backend/src/main.ts:8`, `frontend/src/lib/api/`).
- Keep JSON field names in `camelCase`, timestamps as UTC ISO-8601 strings, and IDs as opaque strings.
- All protected endpoints use `Authorization: Bearer <accessToken>`. Missing/invalid/expired token is `401`; authenticated but disallowed is `403`; an inaccessible owner-scoped resource is returned as `404` to avoid ID probing.
- Mutations reject unknown fields with `422`; v1 silently strips them (`backend/src/main.ts:12-17`).
- Canonical error body: `{ "code": "STABLE_CODE", "message": "human readable", "details": {}, "requestId": "..." }`. Never include a stack trace, provider error, SQL text, raw CV text, password hash, or token.
- Pagination is required for collection endpoints that can grow: query `limit` default 50/max 100 and opaque `cursor`; response `{items,nextCursor}`. Demo frontend may initially consume the first page.
- No raw uploaded file is persisted. `CV_FILE` means the client extracted text and supplies `rawText`; `LINKEDIN_URL` requires `sourceName` to be the URL plus user-supplied/exported `rawText`. Wave 1 does not crawl LinkedIn or fetch authenticated pages. This makes the actual behavior explicit while preserving the no-object-storage decision (`docs/careermate-scope.md:26-34`).

## 2. Identity, tenant, role, and permission rules

### 2.1 Roles and hierarchy

The fixed management hierarchy is:

`SUPER_ADMIN (0) < COMPANY_ADMIN (1) < BOD (2) < HR (3) < EMPLOYEE (4)`

A company actor can manage only a target in the same current company whose tier number is strictly greater. Self access is handled separately. `SUPER_ADMIN` is global and has no `companyId`. This preserves `backend/src/common/access/role-hierarchy.ts:8-24`.

### 2.2 Effective permissions

Permissions are `VIEW`, `COLLECT`, `CROSS_ASSESS`, `APPROVE`, `EDIT`, `FULL` (`backend/prisma/schema.prisma:22-29`). Wave 1 consumes `VIEW`, `COLLECT`, `EDIT`, and `FULL`.

Decision for v2:

1. `SUPER_ADMIN` always resolves to `[FULL]`.
2. A user-level permission override is nullable: `NULL` means inherit the company's role definition; `[]` means explicitly no permissions; a non-empty array is the exact override. This distinction must exist in the v2 schema.
3. Otherwise resolve the `(companyId, role)` role definition. Missing definition is deny-by-default (`[]`).
4. `FULL` satisfies every permission check.
5. Permission checks are additive to tenant and role hierarchy checks; a permission never grants cross-tenant access or authority over a peer/superior.
6. Role/company/permission state is loaded from the database on every authenticated request so a role change takes effect immediately. Do not trust role/company values embedded in the JWT as authorization truth.

Default role definitions per company:

| Role | Default permissions | Hidden/fixed |
|---|---|---|
| COMPANY_ADMIN | FULL | yes |
| BOD | VIEW, APPROVE | no |
| HR | VIEW, COLLECT, CROSS_ASSESS, EDIT | no |
| EMPLOYEE | none | yes |

### 2.3 Action matrix

| Action | Self | Same-company manager of lower tier | SUPER_ADMIN |
|---|---:|---:|---:|
| Read own account/private profile | allow | n/a | allow |
| Read another person's competency profile | no | requires `VIEW` | allow |
| Create a lower-tier user | no | requires `COLLECT` | allow |
| Edit another user's HR-owned fields/role | no | requires `EDIT` | allow |
| Delete/deactivate user | no | `FULL` only | allow |
| Edit own personal fields | allow for allowlist only | n/a | allow |
| Create/update own skills/cert/project/award | allow | n/a | allow |
| Record a profile item for employee | n/a | requires `COLLECT` on lower-tier same-company target | allow |
| Edit/delete employee profile item | n/a | requires `EDIT` on lower-tier same-company target | allow |
| Create/update employment for employee | no for arbitrary company; see section 5 | requires `COLLECT`/`EDIT` | allow |
| Create/parse/apply/delete profile import | owner only | deny | owner only when acting as own account |

Self-edit allowlist is `name`, `jobTitle`, `avatarUrl`, `themeConcept`, `phone`, `dateOfBirth`, `gender`, `emergencyContactName`, `emergencyContactPhone`. Self-edit must reject `role`, `companyId`, `onboardDate`, `contributionScore`, `attitudeScore`, permissions, or any verification/provenance field. V1 currently accepts self-written score fields through `UpdateUserDto` (`backend/src/modules/users/dto/update-user.dto.ts:36-42`) and spreads them into the update (`backend/src/modules/users/users.service.ts:198-206`); v2 must not.

### 2.4 Response projections and privacy

- `AccountSelf`: id, email, name, role, companyId/name, avatarUrl, jobTitle, themeConcept, effective permissions, permitted private personal fields.
- `RosterSummary`: id, name, role, avatarUrl, jobTitle, companyId only. No DOB, ID number, phone, emergency contacts, scores, or email unless a screen has a justified need.
- `ProfileHeader`: id, name, optional email for self/admin, role, jobTitle, avatarUrl, contribution/attitude scores, current company summary.
- A company-scoped viewer never receives employment periods or company-bound projects belonging to a different company. Self and `SUPER_ADMIN` may receive the complete portable history. Personal skills/certifications/awards and projects not bound to an employer are visible to a permitted current-company viewer while the subject is currently affiliated.
- Former-company staff cannot inspect a departed person's whole profile merely because an old Employment exists. Later passport-share flows are the consent boundary (`docs/careermate-scope.md:72-77`).

## 3. Auth contract

| Method/path | Auth | Request | Success | Acceptance rules |
|---|---|---|---|---|
| `POST /api/auth/login` | public | `{email,password}` | `200 {accessToken,user: AccountSelf}` | Normalize email with trim + Unicode-aware lowercase; generic `401 INVALID_CREDENTIALS`; constant-behavior password verification; disabled/archived company or user is denied; return effective DB permissions, not stale per-user data. |
| `POST /api/auth/register` | public, bootstrap only | `{email,password,name}` | `201 {accessToken,user}` | Only when zero users exist. Acquire a transaction-scoped advisory/system lock, re-count inside a serializable transaction, then create exactly one `SUPER_ADMIN`. Concurrent different emails cannot create two super admins. Disable route after bootstrap. |
| `GET /api/auth/me` | bearer | none | `200 AccountSelf` | Read current database role, company, status, and effective permissions. Deleted/deactivated user is `401`. |

Security decisions:

- `JWT_SECRET`, issuer, audience, and expiry are required configuration. Startup fails if missing; remove the v1 fallback `dev-secret-change-me` (`backend/src/modules/auth/jwt.strategy.ts:30-35`).
- Access token payload contains only subject, issued/expiry, issuer, audience, and a token ID. Authorization comes from current DB state.
- New passwords are Argon2id hashes. Existing bcrypt hashes are accepted during migration and transparently rehashed after a successful login. Password is minimum 8 characters for Wave 1; seed password comes only from an environment variable.
- Refresh tokens, SSO, password reset, and account invitation are explicitly outside Wave 1. Their absence must be recorded in the Wave 1 report.

## 4. Company and minimal user-management contract

### 4.1 Company endpoints

| Method/path | Required authority | Request/response | Contract |
|---|---|---|---|
| `GET /api/companies` | SUPER_ADMIN | paged `CompanySummary` | Includes active and archived filter; no user secrets. |
| `POST /api/companies` | SUPER_ADMIN | `{name,industry?,adminEmail,adminName,adminPassword}` → `201 CompanyDetail` | One atomic transaction creates Company, its COMPANY_ADMIN, and all four role definitions. Duplicate normalized admin email is `409`. |
| `GET /api/companies/me` | COMPANY_ADMIN | `CompanyDetail` | Must have non-null company and active company. |
| `PATCH /api/companies/me` | COMPANY_ADMIN + FULL | `{name?,industry?}` | Tenant pinned to caller; empty patch `422`. |
| `GET /api/companies/{id}` | SUPER_ADMIN | `CompanyDetail` | `404` if absent. |
| `PATCH /api/companies/{id}` | SUPER_ADMIN | `{name?,industry?}` | `404` absent; empty patch `422`. |
| `DELETE /api/companies/{id}` | SUPER_ADMIN | `200 {id,status:"ARCHIVED"}` | Soft archive only, atomically deactivate tenant logins and prevent new tenant writes. Never cascade-delete Employment or career history. Repeating is idempotent. |

Company provisioning must roll back the company and admin if any role definition fails. V1 creates Company/admin first and definitions second (`backend/src/modules/companies/companies.service.ts:42-83`), allowing partial provisioning.

### 4.2 User endpoints needed by Wave 1

| Method/path | Authority | Contract |
|---|---|---|
| `GET /api/users` | bearer | Employee receives same-company `RosterSummary` only; manager receives manageable lower-tier roster and needs `VIEW`; SUPER_ADMIN may filter by `companyId`. Paged. |
| `GET /api/users/{id}` | self, SUPER_ADMIN, or same-company `VIEW` manager | Self gets `AccountSelf`; managers get the HR projection their permissions permit; ordinary employees get only `RosterSummary` for a same-company peer. |
| `POST /api/users` | SUPER_ADMIN or same-company `COLLECT` manager | `{email,password,name,role,companyId?,jobTitle?}`. Non-super caller's company is forced from auth; role must be lower tier. SUPER_ADMIN role has null company; all other roles require an existing active company. |
| `PATCH /api/users/{id}` | self allowlist; or same-company `EDIT` manager; SUPER_ADMIN | Reject forbidden fields rather than discard. A caller cannot promote to own/higher tier or edit a peer/superior. Changing current company is only performed by Employment workflow. |
| `DELETE /api/users/{id}` | SUPER_ADMIN or same-company FULL manager of lower tier | Soft deactivate account. Do not delete career history. Cannot delete self or the last active SUPER_ADMIN. |

V1's shared `PUBLIC_USER_SELECT` exposes phone, DOB, government ID and emergency contacts to same-company employees (`backend/src/modules/users/users.service.ts:21-42,68-73,228-235`). No v2 endpoint may reuse a single broad projection for roster and private profile.

## 5. Employment contract

`Employment` is the durable company-period record; `User.companyId` is only the current-employer pointer (`docs/careermate-scope.md:54-68`).

| Method/path | Authority | Request/response | Contract |
|---|---|---|---|
| `GET /api/career-passport/employments?userId=` | self; SUPER_ADMIN; same-company lower-tier manager + VIEW | paged Employment | Self/SA see all periods. Company manager sees only rows with `employment.companyId == caller.companyId`, never other employers. |
| `POST /api/career-passport/employments` | same-company lower-tier manager + COLLECT; SUPER_ADMIN; self only for own current company | `{userId?,companyId?,jobTitle,level?,department?,startDate,endDate?}` → `201 Employment` | Non-SA manager is pinned to own company and target must currently belong to it. Employee self-create is allowed only for own current `companyId`; unaffiliated users cannot claim an on-platform company in Wave 1. `endDate >= startDate`. With no endDate status is ACTIVE; with endDate status is ENDED. |
| `PATCH /api/career-passport/employments/{id}` | owner only for descriptive fields on current-company row; same-company lower-tier manager + EDIT; SUPER_ADMIN | `{jobTitle?,level?,department?,startDate?,endDate?,status?}` | Tenant is derived from row. Owner cannot change user/company/status or end a period. Manager/SA can end. ENDED is terminal in Wave 1; no reopen. |

Database invariants:

- Partial unique constraint: at most one `ACTIVE` Employment per user.
- `ACTIVE` requires `endDate IS NULL`; `ENDED` requires non-null endDate; end date cannot precede start date.
- `employment.companyId` uses restrict/soft-reference semantics for company deletion, never cascade. Employment survives company archive.
- Creating an ACTIVE period atomically sets `User.companyId` to the employment company after validating no active period.
- Ending a period locks the Employment and User rows, updates status/endDate, and clears `User.companyId` only if it still points to that company and no other active row exists. All steps commit or roll back together. V1 updates Employment and later clears User in separate operations (`backend/src/modules/career-passport/career-passport.service.ts:124-157`).
- No Employment hard-delete endpoint in Wave 1.

## 6. Skills contract

| Method/path | Authority | Contract |
|---|---|---|
| `GET /api/skills-competency/skills` | bearer | Paged catalog, filter `q`/`category`, stable sort by normalized name. |
| `POST /api/skills-competency/skills` | bearer | `{name,category?}` → existing or `201` new. Normalize trim, collapse whitespace and case-fold uniqueness. Same normalized name never creates duplicates under concurrency. Existing category is not silently overwritten by employees. |
| `GET /api/skills-competency/users/{userId}` | self; SUPER_ADMIN; same-company lower-tier manager + VIEW | List `{id,userId,skillId,level,selfAssessed,note,skill}`. |
| `PUT /api/skills-competency/users/{userId}/skills` | owner only | `{skills:[{skillId,level,note?}]}` | Upsert listed skills; 1–5 integer level; reject duplicate skill IDs and unknown catalog IDs. Entire batch is atomic. Empty list is a no-op and does not delete existing rows. |

Wave 1 preserves the v1 self-assessment semantics (`backend/src/modules/skills-competency/skills-competency.service.ts:56-94`) but replaces its per-item commits with one transaction.

## 7. Competency profile and owned resource contract

### 7.1 Aggregate

`GET /api/competency-profile?userId=<optional>` is the canonical aggregate endpoint and keeps the actual v1 route (`backend/src/modules/competency-profile/competency-profile.controller.ts:33-44`). Missing `userId` means self.

Response:

```json
{
  "user": "ProfileHeader",
  "skills": [],
  "certifications": [],
  "projects": [],
  "awards": [],
  "employments": [],
  "timeline": []
}
```

Each timeline item is `{id,kind,title,subtitle,date,endDate,meta}` where `kind` is `EMPLOYMENT|PROJECT|CERTIFICATION|AWARD|ACTIVITY`. Items without a meaningful primary date are excluded. Sort deterministically by primary date descending, then kind, then ID. Read all sections in one repeatable-read transaction/snapshot so totals and timeline cannot disagree.

Tenant filtering follows section 2.4. Activity items are limited to the latest 20 as in v1 (`backend/src/modules/competency-profile/competency-profile.service.ts:234-286`), but only activities visible to the caller may be included.

### 7.2 Certifications

| Method/path | Contract |
|---|---|
| `GET /api/competency-profile/certifications?userId=` | Same read policy as aggregate; paged. |
| `POST /api/competency-profile/certifications` | Owner, or `{userId}` same-company lower-tier manager + COLLECT. Fields: `name`, `issuer?`, `type?`, `score?`, `issuedAt?`, `expiresAt?`, `credentialUrl?`. |
| `PATCH /api/competency-profile/certifications/{id}` | Owner or scoped manager + EDIT; derive owner from row. |
| `DELETE /api/competency-profile/certifications/{id}` | Same as patch; return `{id}`; second delete is `404`. |

`type` is `DEGREE|LANGUAGE|PROFESSIONAL|OTHER`; `expiresAt >= issuedAt` when both exist; URL is absolute `http`/`https` or null.

### 7.3 Projects

| Method/path | Contract |
|---|---|
| `GET /api/competency-profile/projects?userId=` | Same read policy as aggregate; paged. |
| `POST /api/competency-profile/projects` | Owner or `{userId}` scoped manager + COLLECT. Fields: `employmentId?`, `name`, `role`, `domain?`, `techStack?`, `contribution?`, `startDate`, `endDate?`. |
| `PATCH /api/competency-profile/projects/{id}` | Owner or scoped manager + EDIT. |
| `DELETE /api/competency-profile/projects/{id}` | Same as patch. |

If `employmentId` is present, the Employment must belong to the same profile owner; `companyId` is copied from that Employment and cannot come from request/caller. If absent, `companyId` is null unless a scoped admin is recording it for their own company. `endDate >= startDate`. This closes v1's unchecked arbitrary employment link (`backend/src/modules/competency-profile/competency-profile.service.ts:116-129,133-155`).

### 7.4 Awards

| Method/path | Contract |
|---|---|
| `GET /api/competency-profile/awards?userId=` | Same read policy as aggregate; paged. |
| `POST /api/competency-profile/awards` | Owner or `{userId}` scoped manager + COLLECT. Fields: `title`, `category?`, `issuer?`, `description?`, `evidenceUrl?`, `awardedAt?`. |
| `PATCH /api/competency-profile/awards/{id}` | Owner or scoped manager + EDIT. |
| `DELETE /api/competency-profile/awards/{id}` | Same as patch. |

`category` is `WORK|PERSONAL`; `selfReported=true` for owner write and false for admin write. Evidence URL is absolute `http`/`https` or null.

### 7.5 Provenance

Certification, ProjectExperience, Award, and EmployeeSkill need `sourceType` (`SELF|ADMIN|IMPORT`), nullable `sourceImportId`, and audit timestamps/actor. The client cannot set these. Imported rows are linked to the import and import item key; manual rows remain independent.

## 8. Profile import and anti-hallucination contract

### 8.1 Endpoints and state machine

| Method/path | Authority | Contract |
|---|---|---|
| `GET /api/profile-imports` | owner | Paged metadata and parsed proposal; raw text omitted from list. |
| `GET /api/profile-imports/{id}` | owner | Full import, including rawText for review. Foreign/missing ID is `404`. |
| `POST /api/profile-imports` | owner | `{sourceType,sourceName?,rawText}` → `201`, status `PENDING`. Raw text trim length 20..100000. Validate URL when source type is LINKEDIN_URL. |
| `POST /api/profile-imports/{id}/parse` | owner | No body. Returns staged proposal with status `PARSED`; never writes profile entities. Safe retry from `PENDING` or `FAILED`; APPLIED is `409`. |
| `POST /api/profile-imports/{id}/apply` | owner | Final reviewed fields plus `proposalVersion` and `Idempotency-Key` header. Applies all selected/edited items atomically, returns `{import,applied}`. |
| `DELETE /api/profile-imports/{id}` | owner | Allowed only PENDING/FAILED/PARSED. Applied import is retained as provenance (`409`). |

States: `PENDING -> PROCESSING -> PARSED -> APPLIED`; `PROCESSING -> FAILED`; `FAILED -> PROCESSING`. Add `PROCESSING`, `proposalVersion`, `applyResult`, attempt timestamps, and a sanitized error code. A compare-and-swap status update prevents two parse calls from running concurrently.

### 8.2 Proposal schema

The proposal retains the v1 sections: profile/job title, skills, certifications, projects, awards, and summary (`backend/src/modules/profile-imports/profile-imports.service.ts:20-48`). Every proposed item also carries:

```json
{
  "proposalItemId": "stable-within-version",
  "confidence": 0.0,
  "evidence": [{"quote":"short source excerpt","start":0,"end":12}],
  "warnings": []
}
```

Rules:

- The CV text is untrusted data, delimited separately from system instructions. Prompts explicitly ignore instructions found inside the document.
- Provider output must pass a strict server-side schema: allowed enums only, skill level integer 1–5, valid dates, bounded strings/array counts, evidence offsets inside `rawText`, and no unknown fields.
- An item with no supporting evidence is kept unselected with a warning; it is never preselected. The model must return empty arrays for absent facts and may not infer employers, credentials, dates, scores, or awards.
- `parse` stores only a proposal. `apply` receives the user's final reviewed selection/edit and never calls AI.
- The UI must show source evidence and confidence as assistance, not as verification. Imported skill levels remain `selfAssessed=true`; awards remain self-reported unless an authorized admin later verifies them.
- Provider/model/prompt version and proposal version are recorded for audit; raw provider payload and secrets are not logged.
- Tests use a fake provider with fixed fixtures, malformed JSON, prompt-injection text, unsupported enum/date, timeout, and empty extraction. No real provider or company API key is used in Wave 1 tests.

### 8.3 Atomic and idempotent apply

Inside one serializable transaction:

1. Lock the ProfileImport owner row and verify `PARSED`, matching `proposalVersion`, and caller ownership.
2. If the same idempotency key was already committed, return the stored `applyResult` unchanged.
3. Validate every final item before the first write, including project/employment ownership.
4. Update job title if selected; normalize/upsert catalog skills; upsert user skill rows; create certification/project/award rows with `(sourceImportId, proposalItemId)` uniqueness.
5. Mark import `APPLIED`, set `appliedAt`, persist counts/result and idempotency key.
6. Commit all or roll back all.

V1 currently performs each write separately and can partially apply or duplicate certifications/projects/awards on replay (`backend/src/modules/profile-imports/profile-imports.service.ts:146-247`). It also accepts arbitrary client data without binding it to a proposal version. Both behaviors are rejected by this contract.

## 9. Transaction boundary checklist

| Use case | Required boundary/invariant |
|---|---|
| Bootstrap first super admin | Serializable transaction + singleton/advisory lock. |
| Provision company | Company + admin + role definitions in one transaction. |
| Normalize unique email/skill | Database-backed normalized unique key; catch race as `409`, not pre-check only. |
| Change role/deactivate user | Lock target; authorize against current state; write audit event atomically. |
| Create active employment | Lock user; assert no active row; create row + set current company atomically. |
| End employment | Lock user/employment; end + clear current company atomically. |
| Batch skill upsert | Validate all IDs then one transaction. |
| Project linked to employment | Validate same owner/company and create/update in one transaction. |
| Profile aggregate | Repeatable-read snapshot for all sections and timeline. |
| Parse import | Short state transaction before provider call; short result transaction after. Never hold DB transaction during AI call. |
| Apply import | Serializable row lock; all entity writes + final APPLIED status in one transaction. |
| Archive company | Archive company and deactivate tenant access atomically; retain career history. |

Every successful mutation emits an audit record with actor ID, action, entity type/ID, company scope, request ID, timestamp, and a field-name diff. The audit payload must not contain passwords, tokens, raw CV text, government ID, or provider keys.

## 10. Seed personas and deterministic fixtures

Seed is idempotent and uses stable IDs/natural keys. It reads one `CAREERMATE_DEMO_PASSWORD` environment value and fails if absent; no password is committed or printed. V1 hard-codes and prints one shared demo password (`backend/prisma/seed.ts:6,381-399`), which v2 must remove.

| Persona | Tenant | Role/effective permissions | Required fixture purpose |
|---|---|---|---|
| `superadmin@careermate.dev` | none | SUPER_ADMIN/FULL | Platform company CRUD and cross-tenant control. |
| `admin@acme.dev` | Acme | COMPANY_ADMIN/FULL | Full tenant management. |
| `hr@acme.dev` | Acme | HR defaults: VIEW,COLLECT,CROSS_ASSESS,EDIT | Employee/profile/employment collection and editing. |
| `bod@acme.dev` | Acme | BOD defaults: VIEW,APPROVE | Read but no Wave 1 collection/edit. |
| `viewer@acme.dev` | Acme | COMPANY_ADMIN override: VIEW | Prove per-user override beats FULL role default. |
| `approver@acme.dev` | Acme | COMPANY_ADMIN override: VIEW,APPROVE | Prove Wave 1 writes stay denied. |
| `assessor@acme.dev` | Acme | COMPANY_ADMIN override: VIEW,COLLECT,CROSS_ASSESS,EDIT | Prove scoped non-FULL operations. |
| `alice@acme.dev` | Acme | EMPLOYEE | Active employment plus skills, one cert, project, award, and one PARSED import proposal. |
| `bob@acme.dev` | Acme | EMPLOYEE | Second same-tenant employee and roster visibility. |
| `carol@acme.dev` | Acme | EMPLOYEE | Third employee and target fixture. |
| `dana@careermate.dev` | none | EMPLOYEE | Portable self-profile after ended employment; no tenant admin surfaces. |
| `admin@beta.dev` | Beta | COMPANY_ADMIN/FULL | Cross-tenant negative tests. |
| `erin@beta.dev` | Beta | EMPLOYEE | Cross-tenant target. |

Acme and Beta use distinct stable company IDs. Alice has exactly one ACTIVE Acme employment. Dana has one ENDED historical employment and null current company. Erin has exactly one ACTIVE Beta employment. Import source text is synthetic and contains no real personal data.

Important v1 mismatch: `viewer`, `approver`, and `assessor` are seeded with narrow `User.adminPermissions` (`backend/prisma/seed.ts:123-162`), but JWT resolution selects the COMPANY_ADMIN RoleDefinition first, which is FULL (`backend/src/modules/auth/jwt.strategy.ts:55-63`; `backend/prisma/seed.ts:63-72`). Therefore all three are effectively FULL in v1. The nullable explicit-override rule above is required and must have integration coverage.

## 11. Required acceptance tests before Wave 1 is accepted

### Auth and authorization

- Login success for every persona; wrong user and wrong password return indistinguishable `401` bodies.
- Two concurrent bootstrap requests with different emails result in exactly one SUPER_ADMIN.
- Missing JWT configuration stops startup.
- Changing a seeded user's permission override affects the next request without issuing a new token.
- Table-driven test for every action matrix cell, including a same-role peer, a higher role, a lower role, no-company Dana, and cross-tenant Erin.
- Roster response never contains passwordHash, DOB, government ID, phone, emergency contacts, private import data, or tokens.

### Company/user/employment

- Injected failure during role-definition provisioning leaves no company or admin.
- Archiving Acme retains every Employment and profile record but denies new Acme sessions/writes.
- Company Admin/BOD/HR cannot create or mutate Beta employment; v1's cross-company gap is covered.
- Two concurrent ACTIVE employment creates for one user yield one success and one `409 ACTIVE_EMPLOYMENT_EXISTS`.
- Injected failure after employment update proves User.companyId and Employment roll back together.
- An Acme viewer of Alice cannot see Alice's employment/project rows belonging to Beta or another historical company.
- Self profile patch cannot change scores, role, company, onboard date, or permissions.

### Profile resources

- Owner CRUD succeeds; foreign owner returns `404`; scoped HR collect/edit succeeds for lower-tier employee; BOD without COLLECT/EDIT fails.
- Certification/award URL and all date-order constraints return `422` before writing.
- A project cannot reference another user's Employment or a hidden cross-tenant Employment.
- Aggregate arrays and timeline reflect one DB snapshot and deterministic ordering.
- Skill batch with one unknown ID writes zero rows; repeated normalized skill names create one catalog row under concurrency.

### Import

- Parse of valid synthetic CV creates only the staged proposal; profile tables remain unchanged.
- Prompt injection inside raw text does not alter output schema or tool behavior.
- Malformed/empty/unsupported AI output yields sanitized FAILED status and no profile writes.
- Evidence offsets and enum/date/level boundaries are validated.
- Apply with one invalid item writes nothing; valid apply writes all selected items and provenance.
- Same Idempotency-Key replay returns the original result and creates no duplicates; different key after APPLIED is also non-mutating/conflict by contract.
- Applying a stale `proposalVersion`, an import owned by another user, or an unparsed import is rejected.

Test layers: pure unit tests for policy/date/normalization and AI schema; repository/service integration tests against an ephemeral test Postgres; HTTP contract tests for status/body/projection; frontend Playwright smoke for login persona switch, self profile CRUD, HR employee view/edit, tenant isolation, parse-review-select-apply, and retry/idempotency display. No real DB, production data, browser account, or provider key is used.

## 12. Baseline-to-v2 mismatch register

| Severity | Verified baseline mismatch | v2 decision |
|---|---|---|
| Blocker | Integration worktree equals `origin/master`; no v2 implementation exists. | Wave 1 starts from this contract; completion cannot be inferred from v1. |
| Critical | Company hard delete cascades Employment (`backend/prisma/schema.prisma:345-366`), contradicting lifelong passport history. | Soft archive Company; Employment is retained. |
| Critical | Narrow Company Admin demo users resolve to FULL because role definition wins over per-user permissions. | Nullable explicit user override wins over role default. |
| Critical | User list/detail exposes private PII to ordinary same-company employees. | Separate AccountSelf, RosterSummary, and manager projections. |
| Critical | Company provisioning spans two commits. | Single atomic transaction. |
| Critical | Import apply is multi-commit and replayable, so failure/retry can leave duplicates. | Serializable, idempotent all-or-nothing apply with provenance. |
| High | COMPANY_ADMIN/BOD can create Employment using another company ID; only HR is explicitly pinned (`backend/src/modules/career-passport/career-passport.service.ts:83-117`). | Derive tenant from caller/target; every non-SA actor is tenant pinned. |
| High | Employment end and clearing current company are separate commits; multiple ACTIVE periods are allowed. | Row-lock transaction plus partial unique ACTIVE constraint. |
| High | Project create/update accepts any `employmentId` without owner/company validation. | Validate ownership and derive company from Employment. |
| High | Company profile aggregate can expose all historical employment and projects after a subject is visible. | Filter company-bound history to caller tenant. |
| High | JWT starts with a known fallback secret when config is absent. | Fail startup on missing JWT config. |
| High | Bootstrap `count` then `create` is raceable. | Serializable singleton lock. |
| High | Self user patch accepts admin-owned contribution/attitude scores. | Field allowlists per actor/action. |
| Medium | Skill bulk upsert commits one row at a time; name uniqueness is case-sensitive/untrimmed. | Atomic batch plus normalized unique key. |
| Medium | `LINKEDIN_URL`/`CV_FILE` still require client-supplied raw text; no URL/file ingestion exists. | Document exact Wave 1 behavior; no crawler/object storage. |
| Medium | Scope doc predicts top-level `/certifications`, `/project-experiences`, `/awards` and path-param aggregate (`docs/careermate-scope.md:127-136`), while code/frontend use `/competency-profile/*` and query `userId`. | Preserve actual client-used endpoints in this contract. |
| Medium | README describes only three role surfaces and says profile/dashboard are open (`README.md:3-20,76-83`), while code/seed now contain BOD/HR and profile modules. | Treat code plus current scope/work-split as baseline; update docs in implementation wave. |
| Medium | No module spec files exist for the Wave 1 controllers/services inspected. | Acceptance requires unit, integration, HTTP contract, and Playwright evidence. |

## 13. Definition of done and evidence artifact

Wave 1 is complete only when all of the following are true:

1. Python service implements every endpoint and rule above with generated OpenAPI schemas.
2. Schema migrations encode the normalized uniqueness, active-employment, non-cascade history, permission override, import state/idempotency, and provenance invariants.
3. Seed is idempotent and all personas produce the stated effective roles/permissions without exposing a credential.
4. Unit, ephemeral-Postgres integration, HTTP contract, and Playwright tests pass from a clean checkout.
5. A Vietnamese `md` or `html` Wave 1 report lists behavior, role/tenant matrix, migration notes, exact test commands/results, known exclusions, and links to evidence. Screenshots alone are not acceptance.
6. A reviewer independently checks tenant isolation, PII projections, transaction fault injection, and import anti-hallucination/idempotency before code is pushed.

## 14. Primary source references

- Product/persona and portable-history decisions: `docs/careermate-scope.md:15-34,54-77,85-99,127-154,165-215`.
- Work split and permission mapping: `docs/careermate-work-split.md:38-77,119-142,183-208`.
- Current auth/JWT: `backend/src/modules/auth/auth.controller.ts:9-27`, `auth.service.ts:22-77`, `jwt.strategy.ts:30-77`.
- Current company provisioning: `backend/src/modules/companies/companies.service.ts:30-105`.
- Current user hierarchy and PII projection: `backend/src/common/access/role-hierarchy.ts:8-24`, `backend/src/modules/users/users.service.ts:21-95,107-235`.
- Current profile API and owner-only writes: `backend/src/modules/competency-profile/competency-profile.controller.ts:33-149`, `competency-profile.service.ts:35-236`.
- Current skills API/batch behavior: `backend/src/modules/skills-competency/skills-competency.controller.ts:20-66`, `skills-competency.service.ts:18-125`.
- Current employment API and split update: `backend/src/modules/career-passport/career-passport.controller.ts:36-74`, `career-passport.service.ts:68-157`.
- Current import proposal/apply: `backend/src/modules/profile-imports/profile-imports.controller.ts:27-67`, `profile-imports.service.ts:72-370`.
- Current persistence relationships: `backend/prisma/schema.prisma:147-267,345-520`.
- Current demo users and role definitions: `backend/prisma/seed.ts:23-207,360-399`.
