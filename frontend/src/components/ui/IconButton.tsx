'use client';

import * as React from 'react';
import MuiIconButton, { type IconButtonProps as MuiIconButtonProps } from '@mui/material/IconButton';
import type { ButtonSize } from '@/theme/tokens';

export type IconButtonProps = Omit<MuiIconButtonProps, 'size'> & {
  size?: ButtonSize | 'small' | 'medium';
};

function toMuiSize(size: IconButtonProps['size']): 'small' | 'medium' {
  return size === 'md' || size === 'medium' ? 'medium' : 'small';
}

/** Icon-only control. Child icons pick up the theme `md` (20px) default. */
const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'sm', ...props },
  ref,
) {
  return <MuiIconButton ref={ref} size={toMuiSize(size)} {...props} />;
});

export default IconButton;
