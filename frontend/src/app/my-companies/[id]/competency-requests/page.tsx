'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import PageSkeleton from '@/components/ui/PageSkeleton';
import StatusChip from '@/components/ui/StatusChip';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  listReceivedCompetencyRequests,
  reviewCompetencyRequest,
  type CompetencyRequestStatus,
  type CompetencyRequestWithSender,
} from '@/lib/api/competencyRequestsApi';

const STATUS_LABEL: Record<CompetencyRequestStatus, string> = {
  PENDING: 'Đang chờ',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Đã từ chối',
};

const SOURCE_LABEL: Record<string, string> = {
  CERTIFICATION: 'Chứng chỉ',
  AWARD: 'Thành tích',
};

function snapshotTitle(request: CompetencyRequestWithSender): string {
  const snap = request.sourceSnapshot as Record<string, unknown>;
  return String(snap.name ?? snap.title ?? 'Không rõ');
}

function snapshotDetail(request: CompetencyRequestWithSender): string {
  const snap = request.sourceSnapshot as Record<string, unknown>;
  const parts = [snap.issuer, snap.score, snap.description].filter(
    (v): v is string => typeof v === 'string' && v.length > 0,
  );
  return parts.join(' · ');
}

/**
 * HR/BOD/COMPANY_ADMIN's inbox for competency requests — an employee asked
 * a specific recipient to review a certification/award and (optionally)
 * award points. Only requests sent directly to the viewer (v1: no
 * company-wide visibility) — see competency-requests.service.ts listReceived.
 */
export default function CompetencyRequestsPage() {
  const { user } = useAuth();
  const canView = user?.role === 'HR' || user?.role === 'BOD' || user?.role === 'COMPANY_ADMIN';

  const [requests, setRequests] = React.useState<CompetencyRequestWithSender[] | null>(null);
  const [filter, setFilter] = React.useState<CompetencyRequestStatus | undefined>('PENDING');
  const [error, setError] = React.useState<string | null>(null);

  const [reviewing, setReviewing] = React.useState<CompetencyRequestWithSender | null>(null);
  const [reviewAction, setReviewAction] = React.useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [pointsAwarded, setPointsAwarded] = React.useState('');
  const [reviewNote, setReviewNote] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback((status?: CompetencyRequestStatus) => {
    listReceivedCompetencyRequests(status)
      .then(setRequests)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Không tải được yêu cầu'));
  }, []);

  React.useEffect(() => {
    if (!canView) return;
    load(filter);
  }, [canView, filter, load]);

  if (!canView) {
    return null;
  }

  const openReview = (request: CompetencyRequestWithSender, action: 'APPROVED' | 'REJECTED') => {
    setReviewing(request);
    setReviewAction(action);
    setPointsAwarded('');
    setReviewNote('');
  };

  const handleSubmitReview = async () => {
    if (!reviewing) return;
    setSaving(true);
    setError(null);
    try {
      await reviewCompetencyRequest(reviewing.id, {
        status: reviewAction,
        pointsAwarded:
          reviewAction === 'APPROVED' && pointsAwarded.trim()
            ? Number(pointsAwarded)
            : undefined,
        reviewNote: reviewNote.trim() || undefined,
      });
      setReviewing(null);
      load(filter);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xử lý được yêu cầu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Yêu cầu"
        subtitle="Nhân viên gửi yêu cầu xem xét chứng chỉ/thành tích để cộng điểm hoặc ghi nhận năng lực."
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? 'contained' : 'outlined'}
            onClick={() => setFilter(s)}
          >
            {STATUS_LABEL[s]}
          </Button>
        ))}
      </Stack>

      <Card>
        {!requests ? (
          <PageSkeleton variant="list" rows={3} embedded />
        ) : requests.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Không có yêu cầu nào.
          </Typography>
        ) : (
          <Stack divider={<Divider />} spacing={2}>
            {requests.map((request) => (
              <Box
                key={request.id}
                sx={{
                  pt: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2,
                  flexDirection: { xs: 'column', sm: 'row' },
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {snapshotTitle(request)}
                    </Typography>
                    <StatusChip label={SOURCE_LABEL[request.sourceType] ?? request.sourceType} tone="info" />
                    <StatusChip label={STATUS_LABEL[request.status]} />
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Từ {request.sender.name} ({request.sender.email})
                    {snapshotDetail(request) ? ` · ${snapshotDetail(request)}` : ''}
                  </Typography>
                  {request.message ? (
                    <Typography variant="body2" sx={{ mt: 0.5 }}>
                      “{request.message}”
                    </Typography>
                  ) : null}
                  {request.status !== 'PENDING' ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      {request.pointsAwarded ? `Đã cộng ${request.pointsAwarded} điểm. ` : ''}
                      {request.reviewNote ?? ''}
                    </Typography>
                  ) : null}
                </Box>
                {request.status === 'PENDING' ? (
                  <Stack direction="row" spacing={1}>
                    <Button size="sm" variant="contained" onClick={() => openReview(request, 'APPROVED')}>
                      Duyệt
                    </Button>
                    <Button size="sm" color="error" onClick={() => openReview(request, 'REJECTED')}>
                      Từ chối
                    </Button>
                  </Stack>
                ) : null}
              </Box>
            ))}
          </Stack>
        )}
      </Card>

      <Dialog
        open={!!reviewing}
        onClose={() => setReviewing(null)}
        title={reviewAction === 'APPROVED' ? 'Duyệt yêu cầu' : 'Từ chối yêu cầu'}
        actions={
          <>
            <Button variant="text" onClick={() => setReviewing(null)} disabled={saving}>
              Hủy
            </Button>
            <Button variant="contained" onClick={handleSubmitReview} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Xác nhận'}
            </Button>
          </>
        }
      >
        <Stack spacing={2} sx={{ mt: 1 }}>
          {reviewAction === 'APPROVED' ? (
            <TextField
              label="Điểm cộng thêm (tuỳ chọn)"
              type="number"
              value={pointsAwarded}
              onChange={(e) => setPointsAwarded(e.target.value)}
              fullWidth
            />
          ) : null}
          <TextField
            label="Ghi chú (tuỳ chọn)"
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
        </Stack>
      </Dialog>
    </PageContainer>
  );
}
