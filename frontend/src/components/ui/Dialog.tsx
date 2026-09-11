'use client';

import MuiDialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

/**
 * Form / content modal. Put Cancel + primary actions in `actions` using
 * the shared Button. Destructive confirms belong in ConfirmDialog.
 */
export default function Dialog({
  open,
  onClose,
  title,
  children,
  actions,
  maxWidth = 'sm',
  fullWidth = true,
}: DialogProps) {
  return (
    <MuiDialog open={open} onClose={onClose} fullWidth={fullWidth} maxWidth={maxWidth}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      {actions ? <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>{actions}</DialogActions> : null}
    </MuiDialog>
  );
}
