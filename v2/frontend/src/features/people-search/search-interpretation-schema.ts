import { z } from "zod";

const term = z.string().min(1).max(200);

export const searchInterpretationSchema = z.object({
  normalized_query: z.string().min(1).max(2000),
  skills: z.array(z.object({
    name: term,
    canonical_skill_id: z.string().uuid().nullable(),
    required: z.boolean(),
    minimum_level: z.number().int().min(1).max(5).nullable(),
    minimum_years: z.number().min(0).max(60).nullable(),
    minimum_years_exclusive: z.boolean(),
  }).strict()).max(20),
  required_domains: z.array(z.object({ name: term, canonical_domain: term.nullable() }).strict()).max(20),
  availability: z.enum(["AVAILABLE", "AVAILABLE_SOON", "ANY"]),
  minimum_total_years: z.number().min(0).max(60).nullable(),
  minimum_total_years_exclusive: z.boolean(),
  title_keywords: z.array(term).max(20),
  soft_preferences: z.array(term).max(20),
  missing_fields: z.array(z.enum(["ROLE", "SKILLS", "AVAILABILITY", "TIMEFRAME"])).max(4),
  unsupported_constraints: z.array(term).max(20),
}).strict();

export type SearchInterpretation = z.infer<typeof searchInterpretationSchema>;
