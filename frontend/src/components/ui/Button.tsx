'use client';

import * as React from 'react';
import MuiButton, { type ButtonProps as MuiButtonProps } from '@mui/material/Button';
import type { ButtonSize } from '@/theme/tokens';

export type ButtonProps = Omit<MuiButtonProps, 'size'> & {
  /** Prefer `sm` / `md`. `small` / `medium` are MUI aliases. */
  size?: ButtonSize | 'small' | 'medium';
};

function toMuiSize(size: ButtonProps['size']): 'small' | 'medium' {
  return size === 'sm' || size === 'small' ? 'small' : 'medium';
}

/**
 * Shared action button — one line, two sizes (`sm` / `md`). Do not import
 * `@mui/material/Button` at call sites; theme tokens live in theme.ts.
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { size = 'md', ...props },
  ref,
) {
  return <MuiButton ref={ref} size={toMuiSize(size)} {...props} />;
});

export default Button;
