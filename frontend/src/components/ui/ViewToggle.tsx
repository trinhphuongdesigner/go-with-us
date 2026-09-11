'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import ViewModuleOutlinedIcon from '@mui/icons-material/ViewModuleOutlined';
import { colorTokens, radiusTokens, iconSizes } from '@/theme/theme';

export type ViewMode = 'list' | 'card';

export interface ViewToggleProps {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}

const OPTIONS: { value: ViewMode; label: string; icon: React.ReactNode }[] = [
  { value: 'list', label: 'Dạng danh sách', icon: <ViewListOutlinedIcon sx={{ fontSize: iconSizes.sm }} /> },
  { value: 'card', label: 'Dạng thẻ', icon: <ViewModuleOutlinedIcon sx={{ fontSize: iconSizes.sm }} /> },
];

/**
 * List/card view switcher — every list page offers both (agent.md §6, rule 6).
 */
export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <Box
      role="group"
      aria-label="Chế độ xem"
      sx={{
        display: 'inline-flex',
        border: `1px solid ${colorTokens.divider}`,
        borderRadius: `${radiusTokens.md}px`,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {OPTIONS.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <Tooltip key={opt.value} title={opt.label}>
            <Box
              component="button"
              type="button"
              aria-label={opt.label}
              aria-pressed={selected}
              onClick={() => onChange(opt.value)}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 40,
                height: 36,
                border: 'none',
                borderLeft: i > 0 ? `1px solid ${colorTokens.divider}` : 'none',
                cursor: 'pointer',
                color: selected ? colorTokens.accentInk : colorTokens.neutral400,
                backgroundColor: selected ? colorTokens.accent900 : 'transparent',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                '&:hover': {
                  backgroundColor: selected ? colorTokens.accent900 : 'rgba(51,104,160,0.08)',
                },
              }}
            >
              {opt.icon}
            </Box>
          </Tooltip>
        );
      })}
    </Box>
  );
}
