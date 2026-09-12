# People Search shared integration blockers

## Model intent compilation

Blocked by shared `v2/backend/app/ai/gateway.py`. Current `AiTask` has no intent task and `EVIDENCE_REQUIRED_TASKS = frozenset(AiTask)`, though intent compilation has no person evidence.

Minimal shared-owner diff:

```python
class AiTask(StrEnum):
    ...
    PEOPLE_SEARCH_INTENT = "people_search_intent"

EVIDENCE_REQUIRED_TASKS = frozenset(task for task in AiTask if task != AiTask.PEOPLE_SEARCH_INTENT)
```

Gateway owner must also add task policy tests proving strict `AiOutputModel` validation, no evidence requirement for intent only, two-attempt retry ceiling, circuit behavior, unknown/protected attribute clarification, and no candidate/tenant IDs accepted from provider output. Owned router can then replace temporary deterministic planner with `AiGateway.generate(AiTask.PEOPLE_SEARCH_INTENT, ...)`; deterministic parser remains explicit provider-failure fallback and must return clarification for unsupported mandatory constraints.

## Person explanation

`AiTask.PEOPLE_SEARCH_EXPLANATION` exists, but gateway requires immutable `EvidenceBlock` and claim-level `EvidenceRef`. Current shared domain only supplies mutable `User` and `Employment`; inventing source/version/block IDs would violate contract.

W1/profile owner must expose tenant-scoped immutable source blocks plus canonical candidate projection containing skills, skill-specific years, domains, availability, freshness, and aliases. Then owned adapter can implement `AiProvider.generate`, explanation `AiOutputModel`, authorized candidate allowlist, and claim-to-subject/evidence binding through existing `AiGateway`. Until then router returns deterministic factor data with `explanation_source="deterministic_fallback"` and `explanation=null`.

## Current honest capability

Current DB adapter supports active current-tenant employment, merged total employment tenure, titles, and update timestamps. Canonical skills, skill years, domain, availability, and immutable citations remain absent (`None`) at typed projection boundary. Required skill/domain/availability requests fail closed; total-experience request alone can use merged tenure as hard filter.

## Isolated runtime

Shared `app/main.py` remains unchanged by ownership rule. Run deployable composition API from `v2/backend` with `uv run uvicorn app.people_search.app:app --host 127.0.0.1 --port 8131`; it mounts existing auth plus people-search routers and allows credentialed CORS only from `http://127.0.0.1:3131` and `http://localhost:3131`. Production integration still needs shared owner to mount `app.people_search.router.router` under `/api/v2` in `app/main.py`.
