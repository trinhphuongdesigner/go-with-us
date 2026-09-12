import { z } from "zod";

// Shape/binding guard only. Source authorization and hashes are checked server-side.
const evidenceRefSchema = z.object({
  subject_id: z.string().uuid(), tenant_id: z.string().uuid(),
  source_id: z.string().uuid(), source_version_id: z.string().uuid(), block_id: z.string().uuid(),
  char_start: z.number().int().nonnegative(), char_end: z.number().int().positive(),
  quote: z.string().min(1), quote_sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().refine((ref) => ref.char_end > ref.char_start, "Invalid source span");

const factorSchema = z.object({
  code: z.enum(["REQUIRED_SKILL", "PREFERRED_SKILL", "EXPERIENCE", "DOMAIN", "AVAILABILITY", "DATA_FRESHNESS"]),
  points: z.number().min(0).max(100), maximum_points: z.number().positive().max(100),
  evidence_refs: z.array(evidenceRefSchema),
}).strict().refine((factor) => factor.points <= factor.maximum_points && (factor.points === 0 || factor.evidence_refs.length > 0), "Invalid factor contribution or evidence");

export const canonicalCandidateSchema = z.object({
  candidate_id: z.string().uuid(), company_id: z.string().uuid(),
  name: z.string().min(1).max(200), title: z.string().max(200).nullable(),
  score: z.number().min(0).max(100), score_version: z.literal("people-search-canonical-v1"),
  score_factors: z.array(factorSchema).min(1).max(6), evidence_refs: z.array(evidenceRefSchema).min(1),
  data_freshness_at: z.string().datetime({ offset: true }), explanation: z.string().nullable(),
}).strict().superRefine((candidate, context) => {
  const factorRefs = candidate.score_factors.flatMap((factor) => factor.evidence_refs);
  const indexed = new Set(candidate.evidence_refs.map((ref) => JSON.stringify(ref)));
  const contributing = new Set(factorRefs.map((ref) => JSON.stringify(ref)));
  const valid = candidate.score_factors.reduce((sum, factor) => sum + factor.points, 0) === candidate.score
    && new Set(candidate.score_factors.map((factor) => factor.code)).size === candidate.score_factors.length
    && indexed.size === contributing.size && [...indexed].every((key) => contributing.has(key))
    && [...candidate.evidence_refs, ...factorRefs].every((ref) => ref.subject_id === candidate.candidate_id && ref.tenant_id === candidate.company_id);
  if (!valid) context.addIssue({ code: "custom", message: "Invalid canonical score or source binding" });
});

export type CanonicalSearchCandidate = z.infer<typeof canonicalCandidateSchema>;
