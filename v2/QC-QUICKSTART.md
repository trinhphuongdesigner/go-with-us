# CareerMate v2 — local QC

Candidate: branch `codex/v2-qa-consolidation`, worktree `.claude/worktrees/v2-qa`. Run commands **inside this worktree**, not the old root checkout. Feature status and known gaps: [CONSOLIDATION.md](./CONSOLIDATION.md). This is an early QC handoff, not the complete migration of every feature from master.

Run from the repository root with Docker Desktop running (Docker Compose v2 with `--wait`), Git, and OpenSSL available:

```bash
bash v2/scripts/qc.sh up
```

This builds the locked Python 3.12 backend and Next.js production frontend, starts a dedicated PostgreSQL instance, migrates to Alembic head, seeds synthetic QC accounts and WORK/PERSONAL roadmaps, and starts the API and web app. It does not run tests. The first image build requires internet access.

Open [CareerMate QC](http://localhost:3140/login). The API documentation is at [localhost:8140/api/v2/docs](http://localhost:8140/api/v2/docs). Frontend demo mode is **off**: login, permissions, profiles and roadmaps use the local FastAPI service.

The first run creates `v2/.qc.env` with fresh, distinct passwords and file permissions `600`. This file is excluded from Git and Docker build contexts. Open it locally in your editor to get passwords; the script never prints them. Keep this file with the QC database volume and do not paste its contents into chat, screenshots or reports.

| Role | Login email | Password key in `.qc.env` |
| --- | --- | --- |
| SUPER_ADMIN | `superadmin@careermate.dev` | `QC_SUPER_ADMIN_PASSWORD` |
| COMPANY_ADMIN | `admin@acme.dev` | `QC_COMPANY_ADMIN_PASSWORD` |
| BOD | `bod@acme.dev` | `QC_BOD_PASSWORD` |
| HR | `hr@acme.dev` | `QC_HR_PASSWORD` |
| EMPLOYEE | `alice@acme.dev` | `QC_EMPLOYEE_PASSWORD` |

BOD, HR and EMPLOYEE have personal profile and roadmap access. The two pure admin roles manage their authorized scope. Permission checks are enforced by the backend; visible menu items do not grant rights.

The synthetic seed contains two companies, nine accounts and twelve roadmaps. The second company uses `admin@northstar.dev`, `bod@northstar.dev`, `hr@northstar.dev`, and `alex@northstar.dev`; password keys match the same role above. Each BOD/HR/employee has a profile plus WORK and PERSONAL roadmaps; initial WORK progress is 25%. Re-running seed preserves any QC edits, so later progress may differ.

Suggested manual checks for QC: five-role login; switch company as SUPER_ADMIN; edit own profile; switch Công việc/Cá nhân; create/save/reload a roadmap; complete a task; save appearance. Builder is still a preview; AI search/import dependencies and new HR/avatar workflows are not a completed end-to-end migration.

All ports bind to loopback only. Edit `QC_WEB_PORT` (3140), `QC_API_PORT` (8140), or `QC_DB_PORT` (55440) in `.qc.env` if needed, then run `up` again. The browser API URL is embedded during frontend build, so changing the API port requires rebuilding; `up` does this automatically. Use the app on the same machine as Docker.

```bash
bash v2/scripts/qc.sh status
bash v2/scripts/qc.sh logs
bash v2/scripts/qc.sh down
```

`down` preserves both the `careermate-v2-qc_qc-postgres` named volume and `.qc.env`. Running `up` again migrates and seeds the existing QC database without a reset. There is no wipe/reset command. Do not remove the environment file while retaining the database: replacing the PostgreSQL password in the file does not change an initialized database's password.

This package is for local QC only, with synthetic data. It does not connect to an existing application database or use real account/provider credentials. AI providers, malware scanning and OCR are unconfigured; dependent operations remain unavailable or fail closed. A preview label still means a preview, not a working approval or persistence workflow. Do not use this package as a production deployment.

If `up` stops on a build, migration or seed error, later stages do not run. Read the error, keep the database volume and credentials, and retry after resolving the cause. Do not use `docker compose config` without `--quiet`: expanded configuration includes secret values.
