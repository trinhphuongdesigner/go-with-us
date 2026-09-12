'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { colorTokens, radiusTokens } from '@/theme/theme';

const LEVEL_LABELS = ['Mới bắt đầu', 'Cơ bản', 'Khá', 'Giỏi', 'Chuyên gia'];

const SIZES = {
  sm: { height: 6, gap: 3, width: 20 },
  md: { height: 8, gap: 4, width: 28 },
} as const;

export interface SkillLevelMeterProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
  /** Omit for a read-only display; pass to make the segments clickable. */
  onChange?: (value: number) => void;
  /** Show the level word (e.g. "Khá") next to the bar. Default true. */
  showLabel?: boolean;
}

/**
 * Segmented level meter — replaces MUI's star `Rating` for skill levels
 * (style-concept.md keeps decoration minimal; five stars read as a generic
 * "review score" widget rather than a skill-level indicator).
 */
export default function SkillLevelMeter({
  value,
  max = 5,
  size = 'md',
  onChange,
  showLabel = true,
}: SkillLevelMeterProps) {
  const dims = SIZES[size];
  const interactive = Boolean(onChange);
  const label = LEVEL_LABELS[Math.min(Math.max(value, 1), max) - 1] ?? '';

  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ display: 'flex', gap: `${dims.gap}px` }}>
        {Array.from({ length: max }, (_, i) => i + 1).map((segment) => {
          const filled = segment <= value;
          return (
            <Box
              key={segment}
              component={interactive ? 'button' : 'span'}
              type={interactive ? 'button' : undefined}
              onClick={interactive ? () => onChange!(segment) : undefined}
              aria-label={interactive ? `Cấp độ ${segment}` : undefined}
              sx={{
                width: dims.width,
                height: dims.height,
                borderRadius: radiusTokens.sm / 4,
                backgroundColor: filled ? colorTokens.primary : colorTokens.muted,
                border: 'none',
                p: 0,
                cursor: interactive ? 'pointer' : 'default',
                transition: 'background-color 120ms ease',
                '&:hover': interactive
                  ? { backgroundColor: filled ? colorTokens.primary : colorTokens.selectedBorder }
                  : undefined,
              }}
            />
          );
        })}
      </Box>
      {showLabel ? (
        <Typography
          variant="body2"
          sx={{ color: colorTokens.secondary, minWidth: 72 }}
        >
          {label}
        </Typography>
      ) : null}
    </Box>
  );
}
