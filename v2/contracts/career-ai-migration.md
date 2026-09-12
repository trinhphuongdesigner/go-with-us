# Career AI / plans migration

Runtime: FastAPI, SQLAlchemy, Next.js, Radix/Tailwind Bright Milo. No NestJS/MUI runtime.

## Source-to-v2 behavior map

| Upstream feature | v2 implementation |
| --- | --- |
| Goals create/edit/delete, target/current values, progress/date/status | `/development-plans/goals`; separate WORK/PERSONAL. Status `NOT_STARTED`, `IN_PROGRESS`, `ACHIEVED` preserved. |
| Markdown AI generation then explicit save | `POST /development-plans/generate` only returns proposal. `PUT /development-plans/me` commits an immutable revision with expectedVersion. |
| Plan version history | `GET /development-plans/me/history?category=...`, newest first; restore as a new editable draft, never silently overwrite history. |
| Structured AI roadmap proposal | Assistant ROADMAP focus returns validated editable tree. Nothing is written to roadmaps/goals until explicit save. |
| Multiple roadmap attempts and end-goal creation | Existing idempotent save, now creates linked goal from final milestone in the same transaction. |
| Milestone/task add/edit/delete/reorder | Explicit-save tree editor and version-checked `PUT /development-plans/me/roadmaps/{id}`. Completion flags preserved. Existing quick checkbox endpoint remains. |
| Roadmap remove | Version-checked delete; linked goal remains with null roadmapId. |
| Display settings | Character (Milo/guide/standing/An/none), stair/diagram, color, reduced motion, font size; independent of roadmap content. |
| Assistant conversations | Persistent list/detail/new/query/delete/pin/unpin. Ten previous messages replayed to provider. |
| Personal coaching context | Own skills, goals, current plan, roadmap, projects, certifications, employment and approved assessments. |
| Talent assistant | Current granted PEOPLE_READ, maximum 80 employees, company-scoped profile context, references restricted to actual context IDs. Platform user explicitly selects company; conversation scope cannot switch. Revoked roster permission also revokes access to old roster transcripts. |
| Platform provider settings | SUPER_ADMIN only. Shared ANTHROPIC/OPENAI/GEMINI connections, custom HTTPS base URL/model, encrypted secrets, public hasKey only. |

## Integration points

- Import and mount `app.career_ai.routes.router` under `/api/v2`.
- Import registers models; migration `0012_career_ai` follows `0011_profile_extensions`.
- Shared provider API: `await app.career_ai.provider.send_chat(db, system_prompt, messages, provider=None)` returns `{content, provider}`.
- Frontend route `/tro-ly`, `CareerAiSettings` for settings, `CareerPlanPanel` and embedded ROADMAP assistant mounted by persisted roadmap view.

## Operator configuration

Configure through Super Admin → Cài đặt → Kết nối AI, or set:

```dotenv
CAREERMATE_AI_PROVIDER=ANTHROPIC
CAREERMATE_AI_BASE_URL=https://ai-center.madlab.tech
CAREERMATE_AI_MODEL=madison-ai-center
CAREERMATE_AI_API_KEY=<set privately; never commit>
# Optional stable encryption secret. Otherwise a domain-separated hash of JWT secret is used.
CAREERMATE_AI_ENCRYPTION_KEY=<set privately; never commit>
```

Provider selection: explicit requested provider, otherwise first saved connection in Anthropic/OpenAI/Gemini order, otherwise environment. Database connection takes precedence over same-provider environment. Removing database config may expose an existing environment fallback; UI explains this.

Keep encryption secret stable across container rebuilds. Rotating the encryption/JWT secret used for encryption requires re-entering stored provider keys. No decrypted secret is returned or included in error messages. HTTP redirects, credentials in URLs and non-public endpoint addresses are rejected. Missing configuration returns 503; provider failure/malformed output returns explicit 502. No fake success or synthetic AI response.

## Verification boundary

User requested build-only delivery. Module compile/import performed; no regression tests, provider network calls or browser QA performed by this worker. QC should exercise the flows using seeded accounts and an operator-configured AI provider.
