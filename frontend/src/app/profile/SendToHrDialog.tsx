'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Dialog from '@/components/ui/Dialog';
import Button from '@/components/ui/Button';
import { ApiError } from '@/lib/api/client';
import { listUsers } from '@/lib/api/usersApi';
import type { User } from '@/types';
import type { EmploymentEntry } from '@/lib/api/competencyProfileApi';
import {
  createCompetencyRequest,
  type CompetencyRequestSourceType,
} from '@/lib/api/competencyRequestsApi';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Human label shown in the dialog title/body, e.g. the certification name or award title. */
  sourceLabel: string;
  sourceType: CompetencyRequestSourceType;
  sourceId: string;
  employments: EmploymentEntry[];
  onSent: () => void;
}

/**
 * "Gửi yêu cầu tới HR" — pick which current company (if more than one ACTIVE
 * employment) and which HR person at that company should receive a request
 * to review a certification/award. Shared by CertificationsTab and
 * AwardsTab.
 */
export default function SendToHrDialog({
  open,
  onClose,
  sourceLabel,
  sourceType,
  sourceId,
  employments,
  onSent,
}: Props) {
  const activeEmployments = React.useMemo(
    () => employments.filter((e) => e.status === 'ACTIVE'),
    [employments],
  );

  const [employmentId, setEmploymentId] = React.useState('');
  const [hrOptions, setHrOptions] = React.useState<User[] | null>(null);
  const [recipientUserId, setRecipientUserId] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [loadingHr, setLoadingHr] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setMessage('');
    setRecipientUserId('');
    setHrOptions(null);
    setEmploymentId(activeEmployments[0]?.id ?? '');
  }, [open, activeEmployments]);

  const selectedEmployment = activeEmployments.find((e) => e.id === employmentId);

  React.useEffect(() => {
    if (!open || !selectedEmployment) return;
    setLoadingHr(true);
    setRecipientUserId('');
    setError(null);
    listUsers({ role: 'HR', companyId: selectedEmployment.company.id })
      .then(setHrOptions)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được danh sách HR'))
      .finally(() => setLoadingHr(false));
  }, [open, selectedEmployment]);

  const handleSend = async () => {
    if (!selectedEmployment || !recipientUserId) {
      setError('Cần chọn công ty và người nhận.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await createCompetencyRequest({
        sourceType,
        sourceId,
        employmentId: selectedEmployment.id,
        recipientUserId,
        message: message.trim() || undefined,
      });
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không gửi được yêu cầu');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Gửi yêu cầu tới HR"
      actions={
        <>
          <Button variant="text" onClick={onClose} disabled={sending}>
            Hủy
          </Button>
          <Button variant="contained" onClick={handleSend} disabled={sending || activeEmployments.length === 0}>
            {sending ? 'Đang gửi...' : 'Gửi'}
          </Button>
        </>
      }
    >
      <Stack spacing={2} sx={{ mt: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Đề nghị HR xem xét “{sourceLabel}” để cộng điểm hoặc ghi nhận năng lực.
        </Typography>

        {error ? <Alert severity="error">{error}</Alert> : null}

        {activeEmployments.length === 0 ? (
          <Alert severity="warning">Bạn hiện không có công ty đang làm việc để gửi yêu cầu.</Alert>
        ) : (
          <>
            {activeEmployments.length > 1 ? (
              <TextField
                select
                label="Công ty"
                value={employmentId}
                onChange={(e) => setEmploymentId(e.target.value)}
                fullWidth
              >
                {activeEmployments.map((e) => (
                  <MenuItem key={e.id} value={e.id}>
                    {e.company.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}

            <TextField
              select
              label="Gửi tới (HR)"
              value={recipientUserId}
              onChange={(e) => setRecipientUserId(e.target.value)}
              fullWidth
              disabled={loadingHr}
              helperText={
                !loadingHr && hrOptions && hrOptions.length === 0
                  ? 'Công ty này chưa có tài khoản HR.'
                  : undefined
              }
            >
              {(hrOptions ?? []).map((hr) => (
                <MenuItem key={hr.id} value={hr.id}>
                  {hr.name} ({hr.email})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Lời nhắn (tuỳ chọn)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          </>
        )}
      </Stack>
    </Dialog>
  );
}
