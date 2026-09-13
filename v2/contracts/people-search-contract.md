# People Search contract

Current owned implementation for `POST /api/v2/people-search/query`. General target remains `v2/contracts/ai-reliability-contract.md` §5; gaps below are release blockers, not exceptions.

## Request and authorization

Strict body: `{ "query": string }`, 1–2000 characters, unknown fields rejected. Authenticated caller needs `Permission.PEOPLE_READ`; server derives company scope from session identity and never accepts tenant IDs from request.

## Eligibility and ranking

Repository admits only active users in current tenant having an `ACTIVE` employment in current tenant. Loaded employment/evidence rows are tenant-scoped. Hard filters run before limit; deterministic ordering uses score descending, case-folded name, then user UUID.

`CandidateProjection` is typed boundary between current DB adapter and ranking. It exposes total employment experience and explicitly uses `None` for unavailable canonical skills, skill-specific years, domains, and availability. Current DB adapter does not claim those fields.

Required terms are AND hard filters at projection boundary. Preferred terms only affect score. Canonical skill/domain/availability requests now enter `CanonicalSearchService` through the authenticated router when compilation resolves successfully. Unknown required catalog terms still cause `needs_clarification`; an unavailable canonical repository causes `insufficient_evidence`, never a broader title search. The default repository deliberately returns unavailable until W1 supplies verified skill/years/domain/availability projections. Generic total `min_experience_years` in the legacy title/tenure mode uses merged employment tenure and is never represented as skill-specific experience. Overlapping employment intervals merge; future or reversed intervals exclude affected candidate from ranking rather than failing whole tenant search; repository/scorer accept frozen time inputs.

Legacy candidates retain `score_version: "people-search-v1"` with typed mutable row metadata for inspection, never fabricated immutable citations. Canonical candidates use `score_version: "people-search-canonical-v1"`, `candidate_id`, `score_factors`, `evidence_refs`, and `data_freshness_at`, plus authorized display name/title/company. Scores equal the exact sum of factor points. Canonical factors carry source refs validated against immutable blocks and their subject/tenant; response validators repeat score and citation-binding consistency checks. Strict `>` duration is distinct from `>=`; required filters run before top-k. Only active requested factor groups earn points, with versioned relative weights documented in `canonical_ranking.py`. Optional freshness weighting is disabled by default.

`CanonicalRepository.load(intent, tenant_id, actor_id)` returns a complete authorized batch or `None`. Future W1 adapters own SQL eligibility/hard filtering and factual value-to-source lineage; service validation is not a substitute for that work. Service checks exact caller tenant/actor, candidate/profile identity, and source integrity; it exposes only selected profiles. The application runtime builds its catalog from application-owned `Skill` rows and uses the configured company AI connection for intent compilation. The canonical employee-evidence repository remains unavailable by default. Synthetic injected adapters prove the internal/API flow, not real W1 delivery.

Required evidence must cover each hard criterion for every eligible candidate, using the ranker's latest verified, nonfuture, nonconflicting facts. Required skill years/level must be present when constrained; domain, overall experience, and availability require their corresponding facts. Missing evidence returns `insufficient_evidence`, including mixed batches with complete and incomplete eligible candidates. It does not mean the candidate fails the criterion. Verified below-threshold values remain genuine nonmatches; missing optional facts and ineligible candidates do not add hard-evidence requirements. Domain facts are positive assertions, so absence of the requested domain is unknown, not evidence that the candidate lacks that experience.

## Response

`plan.interpretation` exposes validated normalized query, resolved/unresolved skill and domain terms, exact per-skill level/years/exclusive thresholds, separate total-experience threshold, availability, title/soft preferences, missing fields and unsupported constraints. Catalog IDs come only from application resolution; unresolved terms have null catalog identity. The UI renders readable names, not internal IDs, distinguishes `trên` from `từ`, and labels unresolved terms explicitly. Interpretation is absent/null for provider failure, protected-attribute rejection or failed structured-clause preservation. It describes requested conditions, not a claim that those conditions were applied or supported by employee data.

`SearchResponse` has `status`, `plan`, `candidates`, `unsupported_reasons`, `explanation`, and `explanation_source`. Candidate variants are discriminated by `score_version`. Statuses are `ok`, `empty`, `needs_clarification`, `insufficient_evidence`, and `provider_failure`. The UI distinguishes missing evidence from zero matches, and renders immutable source excerpts separately from mutable profile metadata. Current successful ranking returns `explanation: null` and `explanation_source: "deterministic_fallback"`; there is no successful AI narrative claim.

The result view supports cards and a compact list using the same server ordering and result data. Switching view makes no request and retains open citation disclosures. The selected view persists across searches during the mounted page session, not across reloads. Native buttons expose pressed state and keyboard focus; mobile layouts wrap without requiring a wide table.

Provider failures preserve the sanitized `SearchResponse` JSON body but set HTTP status 504 for the exact gateway `provider_timeout` warning and 502 for other provider failures. Unauthorized callers still receive 401/403 before compilation; successful and clarification responses remain 200. The frontend handles non-2xx through its existing error/retry flow.

## AI status and blockers

Model intent compilation is integrated through `AiGateway.generate(PEOPLE_SEARCH_INTENT, ...)`. Only this non-person-fact task is exempt from immutable person evidence preflight. The former regex planner has been removed. The main application route uses the configured v2 AI connection and validates its JSON against the strict local intent schema; the standalone Madison adapter retains bounded SSE lifecycle/size validation, per-request query binding, persistent circuit state and at most two attempts. Application catalogs, never model IDs, resolve skill/domain aliases. Structured UI clauses receive additional preservation checks; unconstrained natural-language interpretation remains model-dependent and is not an exhaustive semantic guarantee.

Person-specific AI explanation is also not integrated. `AiGateway` correctly requires immutable `EvidenceBlock` citations for `PEOPLE_SEARCH_EXPLANATION`, while current schema has only mutable `User`/`Employment` rows. Adapter therefore returns deterministic supported factors and `insufficient evidence` behavior (`explanation=null`) rather than manufacturing source blocks. W1 must provide tenant-scoped immutable source projection before gateway invocation.

Madison transport uses `SecretStr`, defaults `https://ai-center.madlab.tech` and `madison-ai-center`, no key by default, sanitized errors, 15-second timeout, and fail-closed malformed/error/truncated SSE parsing. The wire schema moves unsupported numeric/string/array bounds into descriptions; the original `CompiledIntent` still enforces all bounds locally through `AiGateway`. The parser accepts the declared tool name or the exact observed Madison bridge alias `compile_people_search_ide`; other names remain rejected. Ordinary tests use synthetic transport and dummy keys only. On 2026-09-12 a bounded live compiler check returned HTTP 200, preserved required React with strictly greater than two years, resolved required real-estate, and reported no provider failure or clarification. This proves live intent compilation with synthetic catalogs, not real employee retrieval or complete search delivery. Credentials are in ignored backend `.env`, never frontend code.

## Smoke

Synthetic no-network smoke moved to `app/people_search/smoke.py`; run from `v2/backend` with `uv run python -m app.people_search.smoke`.

## Isolated runtime

From `v2/backend`, run `uv run uvicorn app.people_search.app:app --host 127.0.0.1 --port 8131`. Composition app mounts existing auth and people-search routers and allows credentialed CORS only from frontend port 3131. Shared production `app/main.py` still needs owner-approved router mount.
