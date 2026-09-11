# CareerMate v2 — AI Reliability Contract

Status: implementation contract for FastAPI + Pydantic v2
Version: `0.1.0`
Data policy: examples and fixtures are synthetic; provider credentials never appear in requests, responses, traces, or fixtures.

## 1. Non-negotiable invariants

1. **AI proposes; deterministic application code decides and persists.** A generation endpoint may persist an audit record and a draft proposal, but must not mutate profile, skill, roadmap, assessment, employment, or ranking source-of-truth tables.
2. **Schema validity is not factual validity.** Every provider response must pass Pydantic validation, semantic validation, authorization, allowed-ID checks, and evidence validation before it is returned as usable data.
3. **No unsupported person-specific claim.** Every extracted fact or claim about an employee must reference one or more immutable source blocks. Suggestions may be novel, but their stated basis must cite verified profile facts.
4. **No model-generated authority.** Assessment arithmetic, normalized scores, tenant scope, permissions, candidate eligibility, candidate scores, redaction rules, dates, and state transitions are calculated or enforced by application code.
5. **`INSUFFICIENT_EVIDENCE` and `NEEDS_CLARIFICATION` are successful safe outcomes.** The service must prefer them over guessing.
6. **Untrusted documents are data.** CV text, assessment comments, project descriptions, retrieved chunks, and tool results can never override system policy or enable tools.
7. **Tenant filtering happens before retrieval and after retrieval.** Every source, candidate, and citation must match the authorized tenant or explicit self-owned scope.
8. **Secrets and raw HR content are excluded from telemetry by default.** Logs contain hashes, identifiers, counts, model metadata, timings, and validation outcomes only.
9. **Every write endpoint is idempotent.** It requires an idempotency key, validates the current proposal/version, and records the acting user.
10. **Provider failure cannot silently change semantics.** Fallbacks return `OK` with a required `FALLBACK_USED:<version>` warning and remain proposals.

## 2. Common Pydantic types

The Python implementation should use strict Pydantic v2 models and reject unknown fields at every provider boundary.

```python
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping
from datetime import date
from enum import Enum
from typing import Annotated, Generic, Literal, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

Id = UUID
Sha256 = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{64}$")]
JsonPath = Annotated[str, StringConstraints(pattern=r"^\$([.\[][A-Za-z0-9_\]-]+)*$")]
T = TypeVar("T")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class AiStatus(str, Enum):
    OK = "ok"
    NEEDS_CLARIFICATION = "needs_clarification"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    FAILED = "failed"


class SupportStatus(str, Enum):
    SUPPORTED = "SUPPORTED"
    AMBIGUOUS = "AMBIGUOUS"
    MISSING = "MISSING"
    SELF_ASSERTED = "SELF_ASSERTED"  # only after an explicit user edit


class WarningCode(str, Enum):
    PARTIAL_EXTRACTION = "PARTIAL_EXTRACTION"
    OCR_LOW_QUALITY = "OCR_LOW_QUALITY"
    SOURCE_CONFLICT = "SOURCE_CONFLICT"
    FALLBACK_USED = "FALLBACK_USED"
    STALE_SOURCE = "STALE_SOURCE"
    SENSITIVE_CONTENT_REDACTED = "SENSITIVE_CONTENT_REDACTED"


class AiWarning(StrictModel):
    code: WarningCode
    message: Annotated[str, StringConstraints(min_length=1, max_length=300)]
    field_path: JsonPath | None = None


class EvidenceRef(StrictModel):
    subject_id: Id
    source_id: Id
    source_version_id: Id
    block_id: Id
    tenant_id: Id
    page_number: int | None = Field(default=None, ge=1)
    char_start: int = Field(ge=0)
    char_end: int = Field(gt=0)
    quote: Annotated[str, StringConstraints(min_length=1, max_length=800)]
    quote_sha256: Sha256

    @model_validator(mode="after")
    def valid_span(self) -> "EvidenceRef":
        if self.char_end <= self.char_start:
            raise ValueError("char_end must be greater than char_start")
        return self


class EvidenceBlock(StrictModel):
    """Trusted immutable block loaded by application code."""

    subject_id: Id
    source_id: Id
    source_version_id: Id
    block_id: Id
    tenant_id: Id
    text: str


class ClaimEvidence(StrictModel):
    subject_id: Id
    evidence_refs: tuple[EvidenceRef, ...] = Field(min_length=1, max_length=10)


class AiOutputModel(StrictModel, ABC):
    """Every provider output schema implements these two explicit indexes."""

    @abstractmethod
    def referenced_entity_ids(self) -> frozenset[Id]: ...

    @abstractmethod
    def claim_evidence(self) -> Mapping[str, ClaimEvidence]: ...


class ProposedValue(StrictModel, Generic[T]):
    value: T | None
    support_status: SupportStatus
    evidence_refs: list[EvidenceRef] = Field(default_factory=list, max_length=10)
    note: Annotated[str, StringConstraints(max_length=300)] | None = None

    @model_validator(mode="after")
    def evidence_policy(self) -> "ProposedValue[T]":
        if self.support_status == SupportStatus.SUPPORTED and not self.evidence_refs:
            raise ValueError("SUPPORTED values require evidence")
        if self.support_status == SupportStatus.MISSING and self.value is not None:
            raise ValueError("MISSING values must be null")
        if self.support_status == SupportStatus.SELF_ASSERTED and self.evidence_refs:
            raise ValueError("SELF_ASSERTED values must not impersonate source evidence")
        return self


class AiResult(StrictModel, Generic[T]):
    status: AiStatus
    data: T | None = None
    evidence_refs: tuple[EvidenceRef, ...] = ()
    clarification_questions: tuple[str, ...] = Field(default=(), max_length=5)
    warnings: tuple[str, ...] = Field(default=(), max_length=20)
    trace_id: Id
    prompt_version: str
    schema_version: str
    model: str
    persisted: Literal[False] = False

    @model_validator(mode="after")
    def status_contract(self) -> "AiResult[T]":
        if self.status == AiStatus.NEEDS_CLARIFICATION:
            if not self.clarification_questions or self.data is not None:
                raise ValueError("NEEDS_CLARIFICATION requires questions and no data")
        if self.status in {AiStatus.INSUFFICIENT_EVIDENCE, AiStatus.FAILED}:
            if self.data is not None:
                raise ValueError(f"{self.status} must not expose usable data")
        if self.status == AiStatus.OK and self.data is None:
            raise ValueError(f"{self.status} requires data")
        return self
```

### Evidence validation

Pydantic validates shape only. Before returning `OK`, application code must:

- load `SourceVersion` by `source_version_id` under the authorized tenant;
- verify that `block_id` belongs to that version and is active;
- compare `quote` to `block.text[char_start:char_end]` after one canonical Unicode/newline normalization;
- recompute SHA-256 over the canonical quote and compare `quote_sha256`;
- reject references to a different tenant, owner, version, or invisible source;
- require every block and reference to carry its subject entity, then require every claim's
  deterministic `ClaimEvidence.subject_id` to match all of its cited blocks and references;
- reject provider-created IDs not present in the request allowlist;
- reject `SELF_ASSERTED` in provider output; only the deterministic apply/edit path may assign it;
- calculate `evidence_coverage = supported_claims_with_valid_evidence / supported_claims` and require `1.0` for person-specific facts.

Native provider citations may be mapped to `EvidenceRef`, but they do not replace these checks. For providers that cannot combine citations with strict structured output, request source block IDs and offsets in the structured result and validate them locally.

## 3. Provider and invocation boundary

```python
class AiTask(str, Enum):
    PROFILE_IMPORT = "profile_import"
    ROADMAP_PROPOSAL = "roadmap_proposal"
    ASSESSMENT_SUMMARY = "assessment_summary"
    OFFBOARDING_NARRATIVE = "offboarding_narrative"
    PEOPLE_SEARCH_EXPLANATION = "people_search_explanation"


class ProviderCapabilities(StrictModel):
    structured_output: bool
    strict_tool_use: bool
    native_citations: bool
    embeddings: bool


class EvidenceContext(StrictModel):
    tenant_id: Id
    actor_id: Id
    evidence_blocks: tuple[EvidenceBlock, ...] = ()
    allowed_entity_ids: frozenset[Id] = frozenset()
    clarification_questions: tuple[str, ...] = Field(default=(), max_length=5)
    fixture_id: str | None = None
```

Implementation requirements:

- `AiGateway.generate(task, schema, context, provider=None)` returns a validated
  `AiResult[schema]`. This exact provider-neutral signature is the stable Wave 0 API.
- Application code builds `EvidenceContext` from authorized records. Gateway preflight rejects
  cross-tenant or duplicate blocks before any adapter call.
- Every output `schema` inherits `AiOutputModel`, explicitly returns all scalar/collection entity
  references, and maps each person-specific claim path to a typed `ClaimEvidence` containing its
  deterministic subject and evidence references. The gateway rejects same-tenant citations whose
  subject differs from the claim. Field-name guessing is forbidden.
- Evidence is mandatory for all current `AiTask` values and is derived from the task policy;
  callers cannot disable it in `EvidenceContext`.
- Wave 0 fixtures are exact responses keyed by `(task, fixture_id)`. Synthetic fixture aliases are
  converted to stable UUIDv5 values using the namespace declared in `ai-golden-evals.yaml`; fixture
  providers never echo prompts/documents and expose no read or write tools.
- Adapters choose provider-native strict schema/tool features when supported. Prompt-only JSON is never considered strict.
- Provider capabilities are discovered/configured; a chat credential does not imply an embedding endpoint.
- Stored v1 provider credentials remain read-compatible through an explicit AES-256-GCM
  `iv.authTag.ciphertext` path. Migration computes a keyed context MAC over the unchanged
  ciphertext plus provider-config id, tenant scope, and provider; legacy decryption fails closed
  when that binding is absent or mismatched, without decrypting the secret during migration.
  New writes use `v2.iv.authTag.ciphertext` and AES-GCM AAD bound to
  the immutable provider-config record id, tenant scope, and provider, so ciphertext cannot be
  transplanted between records or tenants. `ENCRYPTION_KEY` is required and must contain 64 hex
  characters (32 bytes). Resolved keys use a secret wrapper and never enter public request models,
  logs, exceptions, fixtures, or result envelopes.
- Default provider execution is limited to two total attempts. A hard ceiling of three attempts
  permits at most two retries when an explicitly versioned policy requires it. Only timeout,
  transport, 429, and provider 5xx adapter signals are retried. Backoff is exponential and bounded;
  sleep and jitter are injected so tests never depend on wall-clock timing.
- Each provider has a circuit breaker. Transient failures open it at the configured threshold;
  requests remain blocked until the recovery interval, then one half-open probe may close it.
  Schema, evidence, authorization, injection, and deterministic-policy failures do not count as
  transient failures and are never retried.
- Non-empty `clarification_questions` return `needs_clarification` before provider invocation.
  Exhausted transient calls return `failed`, or invoke a registered deterministic fallback. A valid
  fallback passes the same schema/evidence/tenant/entity validation, returns `ok`, and carries
  `FALLBACK_USED:<versioned-fallback-id>`.
- Record `AIInvocation` with hashes and metadata before/after the call. Do not store raw prompt, CV, assessment comments, API key, or provider authorization headers in traces.
- Generation endpoints may store the validated proposal document as a draft and an audit row. `persisted` means domain persistence and must remain `false`.

## 4. CV/document import contract

```python
class CvSkillProposal(StrictModel):
    proposal_item_id: Id
    name: ProposedValue[str]
    level: ProposedValue[int]  # null/AMBIGUOUS unless the source supports a level


class CvCertificationProposal(StrictModel):
    proposal_item_id: Id
    name: ProposedValue[str]
    issuer: ProposedValue[str]
    issued_on: ProposedValue[date]


class CvProjectProposal(StrictModel):
    proposal_item_id: Id
    name: ProposedValue[str]
    role: ProposedValue[str]
    contribution: ProposedValue[str]
    started_on: ProposedValue[date]
    ended_on: ProposedValue[date]


class CvImportProposal(StrictModel):
    proposal_id: Id
    import_id: Id
    source_version_id: Id
    full_name: ProposedValue[str]
    current_title: ProposedValue[str]
    skills: list[CvSkillProposal]
    certifications: list[CvCertificationProposal]
    projects: list[CvProjectProposal]
    extraction_summary: str
```

Rules:

- The parser stores immutable ordered `SourceBlock`s with page and offset metadata before extraction.
- Provider output may only use source/block IDs supplied in the request.
- Missing values stay `null`; never default skill level, role, date, issuer, employer, or score.
- Duplicate source SHA-256 returns the existing import/proposal unless an explicit `force_new_version` action is authorized.
- Parsing produces a proposal only. No `EmployeeSkill`, `Certification`, `ProjectExperience`, `Award`, or `User` row changes.

Apply is a separate non-AI command:

```python
class CvApplyItem(StrictModel):
    proposal_item_id: Id
    selected: bool
    edited_value: dict | None = None


class CvApplyCommand(StrictModel):
    proposal_id: Id
    proposal_version: int = Field(ge=1)
    items: list[CvApplyItem]
    idempotency_key: Annotated[str, StringConstraints(min_length=16, max_length=100)]


class ApplyResult(StrictModel):
    command_id: Id
    status: Literal["APPLIED", "ALREADY_APPLIED", "REJECTED"]
    created_entity_ids: list[Id]
    skipped_item_ids: list[Id]
```

- Apply only selected item IDs from the active proposal version.
- Unsupported/ambiguous values require an explicit user edit; edited fields are stored as `SELF_ASSERTED` provenance.
- Invented, stale, foreign-tenant, or already-replaced proposal item IDs reject the entire transaction.
- A repeated idempotency key returns the original `ApplyResult` without duplicate writes.

## 5. Job/people search contract

The model compiles intent. It does not query raw SQL, choose tenant scope, invent candidates, or calculate final ranking.

```python
class SkillConstraint(StrictModel):
    canonical_skill_id: Id
    minimum_level: int | None = Field(default=None, ge=1, le=5)
    minimum_years: float | None = Field(default=None, ge=0, le=60)
    required: bool


class EmployeeSearchPlan(StrictModel):
    normalized_query: str
    skills: list[SkillConstraint]
    required_domains: list[str]
    availability: Literal["AVAILABLE", "AVAILABLE_SOON", "ANY"]
    soft_preferences: list[str]
    excluded_sensitive_attributes: list[str]
    missing_fields: list[Literal["ROLE", "SKILLS", "AVAILABILITY", "TIMEFRAME"]]


class ScoreFactor(StrictModel):
    code: Literal["REQUIRED_SKILL", "PREFERRED_SKILL", "EXPERIENCE", "DOMAIN", "AVAILABILITY", "DATA_FRESHNESS"]
    points: float
    maximum_points: float = Field(gt=0)
    evidence_refs: list[EvidenceRef]


class CandidateMatch(StrictModel):
    candidate_id: Id
    score: float = Field(ge=0, le=100)
    score_factors: list[ScoreFactor]
    explanation: str
    evidence_refs: list[EvidenceRef]
    data_freshness_at: datetime
```

Rules:

- Resolve skill aliases to catalog IDs before search; unresolved required skills cause clarification.
- SQL applies company, active-employment, permission, and hard constraints before any text/vector ranking.
- Application code calculates a versioned score formula and verifies that factor sums equal the published score.
- The explanation generator receives only authorized candidates and their deterministic score breakdowns. Unknown IDs are rejected, not displayed.
- Sensitive/protected attributes are excluded from compilation, ranking, explanation, and traces.
- If embeddings are unavailable, use structured filters + PostgreSQL full-text search. This is a supported mode, not an error.

## 6. Roadmap contract

```python
class RoadmapTaskProposal(StrictModel):
    proposal_item_id: Id
    title: str
    metric: str
    target_value: float | None = None
    due_on: date
    basis_evidence_refs: list[EvidenceRef]


class RoadmapMilestoneProposal(StrictModel):
    proposal_item_id: Id
    order: int = Field(ge=0)
    title: str
    category: Literal["WORK", "PERSONAL"]
    due_on: date
    rationale: str
    basis_evidence_refs: list[EvidenceRef]
    tasks: list[RoadmapTaskProposal] = Field(min_length=1)


class RoadmapProposal(StrictModel):
    proposal_id: Id
    subject_user_id: Id
    target_role: str
    horizon_months: int = Field(ge=1, le=36)
    weekly_hours: float = Field(gt=0, le=60)
    assumptions: list[str]
    milestones: list[RoadmapMilestoneProposal] = Field(min_length=1, max_length=12)
```

Rules:

- If target role, horizon, available weekly time, or essential profile facts are absent, return `NEEDS_CLARIFICATION` with no proposal.
- Every statement about current skills, gaps, experience, or goals requires evidence. Recommendations are labeled as suggestions and cite the facts that motivate them.
- Deterministic validation enforces unique/order-contiguous milestones, nondecreasing dates, tasks no later than their milestone, measurable metrics, maximum sizes, and allowed subject ID.
- Generation never saves milestones/tasks. UI edits local proposal state; a separate idempotent Save command persists the edited tree and records edited fields as user-authored.
- Timeout fallback uses a versioned deterministic template generated from selected skill gaps; result is `OK` with `FALLBACK_USED:<version>`.

## 7. Assessment and offboarding summary contract

```python
class DimensionScore(StrictModel):
    dimension: Literal["ATTENDANCE", "PROACTIVENESS", "KNOWLEDGE", "SKILL", "ACTIVITY_PARTICIPATION"]
    score: float = Field(ge=0, le=100)
    assessment_ids: list[Id] = Field(min_length=1)
    calculation_version: str


class SupportedClaim(StrictModel):
    claim_id: Id
    text: str
    evidence_refs: list[EvidenceRef] = Field(min_length=1)


class AssessmentSummaryProposal(StrictModel):
    proposal_id: Id
    subject_user_id: Id
    approved_assessment_ids: list[Id] = Field(min_length=1)
    dimension_scores: list[DimensionScore]
    narrative_claims: list[SupportedClaim]
    disagreements: list[SupportedClaim]
    redaction_placeholders: list[str]
    evaluation_locked: Literal[True] = True
```

Rules:

- Application code filters `APPROVED` assessments, loads immutable template snapshots, and calculates weighted/normalized dimension scores before calling the model.
- Model output must echo the supplied score objects byte-for-byte after canonical serialization. Any change is rejected.
- Pending/rejected/draft assessments never enter model context or evidence.
- Preserve materially conflicting reviewer evidence in `disagreements`; do not average it into a fabricated consensus narrative.
- Pseudonymize project/client/person names before the provider call, then run a deterministic leak scan over the output.
- Narrative claims need evidence. Unknown assessment/source IDs are rejected.
- API permits authorized admin edits to narrative/redaction replacements only. Attempts to edit `dimension_scores`, approved source IDs, or locked evaluation fields return `403` and make no changes.

## 8. Error mapping and persistence boundary

| Condition | HTTP | `AiStatus` | Domain writes |
|---|---:|---|---|
| Valid proposal | 200 | `OK` | none |
| Required context absent | 200 | `NEEDS_CLARIFICATION` | none |
| No valid supporting evidence | 200 | `INSUFFICIENT_EVIDENCE` | none |
| Deterministic fallback returned | 200 | `OK` plus `FALLBACK_USED:<version>` | none |
| Malformed/invalid provider output after bounded retry | 502 | `FAILED` | none |
| Provider timeout with no fallback | 504 | `FAILED` | none |
| Invented entity/source ID | 502 | `FAILED` | none |
| Cross-tenant source/candidate | 403 plus security audit | no usable result | none |
| Invalid/stale apply command | 409/422 | not an AI result | none |
| Repeated valid apply idempotency key | 200 | not an AI result | replay original result |

Audit/proposal writes are allowed where explicitly stated, but tests named `no-persist` refer to business/domain tables. Each transaction test must compare before/after row counts and content hashes for those tables.

## 9. Required observability fields

Emit metadata-only OpenTelemetry spans and an `AIInvocation` audit row with:

- request/trace/tenant/actor pseudonymous IDs;
- task, route, provider, model alias, prompt version, schema version;
- input source-version hashes and allowed-entity count;
- retrieval mode, retrieved block IDs, ranks, and score components;
- provider latency, retry count, token counts when available;
- schema, semantic, evidence, ACL, injection, and redaction validation outcomes;
- final status, fallback identifier, proposal ID, and apply command ID;
- no raw prompt, document, assessment comment, candidate narrative, API key, token, email, or employee name.

## 10. Release gate

No model/prompt/schema version is promoted unless the golden suite passes:

- 100% schema validity on expected-success cases;
- 0 invented or cross-tenant IDs exposed;
- 100% evidence validity for person-specific claims;
- 0 domain writes from generation operations;
- exact deterministic assessment arithmetic;
- 0 sensitive-name leaks in redaction fixtures;
- all timeout and embedding-unavailable fixtures produce their declared fallback/status;
- LLM-as-judge may score usefulness/tone only after deterministic gates pass and may not override a failing gate.

Wave 0 validates every declaration in `ai-golden-evals.yaml` through `GoldenContractRunner`. The
runner rejects duplicate/skipped cases, unknown assertions, unsafe status/persistence combinations,
unbounded retry fixtures, cross-tenant fixtures that do not forbid foreign provider context, and
weakened release-gate values. It does not execute feature behavior or report behavioral passes:
all 33 behavioral states remain `NOT_RUN` until their feature executors exist. Direct Wave 0 gateway,
resilience, provider-config, and boundary tests remain separate executable evidence. Feature waves
add behavioral executors for their own cases without removing the declaration checks.
