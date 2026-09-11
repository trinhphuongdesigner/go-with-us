'use client';

import * as React from 'react';
import Typography from '@mui/material/Typography';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  confirming?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/** Delete / revoke / irreversible actions — never call the API without this. */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="xs"
      actions={
        <>
          <Button variant="text" onClick={onCancel} disabled={confirming}>
            {cancelLabel}
          </Button>
          <Button
            variant="contained"
            color={danger ? 'error' : 'primary'}
            onClick={() => void onConfirm()}
            disabled={confirming}
          >
            {confirming ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      {description ? (
        <Typography variant="body2" sx={{ pt: 1 }}>
          {description}
        </Typography>
      ) : null}
    </Dialog>
  );
}

export interface ConfirmRequest {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** One dialog instance per screen — call `ask()` from delete handlers. */
export function useConfirmDialog() {
  const [request, setRequest] = React.useState<ConfirmRequest | null>(null);
  const [confirming, setConfirming] = React.useState(false);

  const ask = React.useCallback((next: ConfirmRequest) => {
    setRequest(next);
  }, []);

  const close = React.useCallback(() => {
    if (confirming) return;
    setRequest(null);
  }, [confirming]);

  const handleConfirm = React.useCallback(async () => {
    if (!request) return;
    setConfirming(true);
    try {
      await request.onConfirm();
      setRequest(null);
    } finally {
      setConfirming(false);
    }
  }, [request]);

  const dialog = (
    <ConfirmDialog
      open={Boolean(request)}
      title={request?.title ?? ''}
      description={request?.description}
      confirmLabel={request?.confirmLabel}
      cancelLabel={request?.cancelLabel}
      danger={request?.danger}
      confirming={confirming}
      onConfirm={handleConfirm}
      onCancel={close}
    />
  );

  return { ask, dialog };
}
