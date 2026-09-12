import { BadGatewayException } from '@nestjs/common';

/**
 * Strip a ```json ... ``` or ``` ... ``` fence some models add despite being told not to.
 *
 * - anchored: false (default) — strip the first fence found anywhere in the reply. Use when
 *   the payload IS the JSON (any prose the model added around it should be discarded).
 * - anchored: true — only strip if the ENTIRE trimmed reply is one fence block. Use when the
 *   payload is free-form markdown, not JSON, so a ``` inside the body isn't mistaken for a wrapper.
 */
export function stripJsonFence(
  raw: string,
  opts?: { anchored?: boolean },
): string {
  const trimmed = raw.trim();
  const pattern = opts?.anchored
    ? /^```(?:json)?\s*([\s\S]*?)\s*```$/i
    : /```(?:json)?\s*([\s\S]*?)```/i;
  const match = trimmed.match(pattern);
  return match ? match[1].trim() : trimmed;
}

/**
 * Strip fences, JSON.parse, and throw a consistent BadGatewayException on a genuinely empty
 * reply or a parse failure. Only guarantees the reply parsed as *some* JSON value — callers
 * still do their own shape validation/coercion on the result.
 */
export function parseJsonReplyOrThrow<T>(
  raw: string,
  featureLabel: string,
  opts?: { anchored?: boolean },
): T {
  const text = stripJsonFence(raw, opts);
  if (!text) {
    throw new BadGatewayException(
      `AI provider returned an empty reply for ${featureLabel}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new BadGatewayException(
      `AI provider returned an unparseable reply for ${featureLabel}`,
    );
  }
}

export function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;
}

export function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string')
    : [];
}

/**
 * Plain numeric clamp for new skills: strict `typeof === 'number'` (no string coercion), no
 * rounding. Existing clamp sites (profile-imports skill level, career-passport dimension score)
 * each have bespoke coercion/rounding/default behavior and are intentionally not routed through
 * this — see docs/ai-skills.md.
 */
export function asClampedNumber(
  v: unknown,
  min: number,
  max: number,
  fallback?: number,
): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}
