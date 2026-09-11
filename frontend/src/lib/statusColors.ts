import { colorTokens } from '@/theme/theme';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const TONE_COLORS: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: colorTokens.muted, fg: colorTokens.secondary },
  info: { bg: colorTokens.primarySubtle, fg: colorTokens.primary },
  success: { bg: colorTokens.primarySubtle, fg: colorTokens.primary },
  warning: { bg: colorTokens.sand, fg: colorTokens.body },
  danger: { bg: '#F5E6E2', fg: colorTokens.danger },
};

/**
 * Central status -> tone mapping so nothing sets chip colors by hand at
 * the call site (style-concept.md section 4: "Status chip theo tone").
 * Add new statuses here as real domains land in phase 2 rather than
 * inlining a color in the feature's own component.
 */
const STATUS_TONE_MAP: Record<string, StatusTone> = {
  DRAFT: 'neutral',
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  ACHIEVED: 'success',
  DONE: 'success',
  COMPLETED: 'success',
  FINAL: 'success',
  OPEN: 'info',
  CLOSED: 'neutral',
  ARCHIVED: 'neutral',
};

export function toneForStatus(status: string): StatusTone {
  return STATUS_TONE_MAP[status.toUpperCase()] ?? 'neutral';
}
