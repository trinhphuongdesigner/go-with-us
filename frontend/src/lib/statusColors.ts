import { colorTokens } from '@/theme/theme';

export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const TONE_COLORS: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: '#f1f0f6', fg: colorTokens.neutral400 },
  info: { bg: colorTokens.accent900, fg: colorTokens.accent300 },
  success: { bg: '#e4f6ee', fg: colorTokens.success },
  warning: { bg: '#fdf3e0', fg: '#b9791f' },
  danger: { bg: '#fbe9e9', fg: colorTokens.danger },
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
