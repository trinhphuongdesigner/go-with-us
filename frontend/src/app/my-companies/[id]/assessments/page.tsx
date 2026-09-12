'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import PageSkeleton from '@/components/ui/PageSkeleton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/contexts/CompanyScopeContext';
import { ApiError } from '@/lib/api/client';
import {
  createAssessment,
  getActiveCycle,
  listAssessments,
  listPendingApproval,
  type ActiveCycle,
  type AssessmentListItem,
  type AssessmentStatus,
} from '@/lib/api/assessmentsApi';
import { listUsers } from '@/lib/api/usersApi';
import { ASSESSMENT_STATUS_LABEL, MOOD_LABEL } from '@/lib/labels';
import type { User } from '@/types';

const STATUS_TONE: Record<
  AssessmentStatus,
  'default' | 'success' | 'warning' | 'error'
> = {
  DRAFT: 'default',
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

/**
 * M3 — the Cross Assessment hub, nested inside a company scope since a
 * person can belong to more than one company. An employee lands here to do
 * their monthly self check-in and to assess colleagues in THIS company; an
 * admin also sees what is waiting for approval in this company.
 */
export default function AssessmentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { companyId } = useCompanyScope();

  const isAdmin = user?.role === 'BOD' || user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const [cycle, setCycle] = React.useState<ActiveCycle | null>(null);
  const [received, setReceived] = React.useState<AssessmentListItem[]>([]);
  const [given, setGiven] = React.useState<AssessmentListItem[]>([]);
  const [pending, setPending] = React.useState<AssessmentListItem[]>([]);
  const [colleagues, setColleagues] = React.useState<User[]>([]);

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(false);
  const [colleagueId, setColleagueId] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeCycle, receivedList, givenList, roster] = await Promise.all([
        getActiveCycle(companyId),
        listAssessments('received'),
        listAssessments('mine'),
        listUsers({ companyId }).catch(() => [] as User[]),
      ]);
      setCycle(activeCycle);
      setReceived(receivedList);
      setGiven(givenList);
      setColleagues(roster.filter((u) => u.id !== user?.id));
      if (isAdmin) {
        setPending(await listPendingApproval(companyId).catch(() => []));
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không tải được đánh giá',
      );
    } finally {
      setLoading(false);
    }
  }, [companyId, isAdmin, user?.id]);

  React.useEffect(() => {
    if (!user) return;
    // Wrapped so the initial fetch's setState lands after the effect.
    void (async () => {
      await load();
    })();
  }, [user, load]);

  // An in-progress self check-in for the open cycle, if the user already
  // started one — so we resume rather than creating duplicates.
  const openSelfDraft = given.find(
    (a) =>
      a.type === 'SELF' &&
      a.status === 'DRAFT' &&
      (!cycle || a.cycle?.id === cycle.id),
  );

  const startAssessment = async (
    type: 'SELF' | 'PEER',
    revieweeId?: string,
  ) => {
    setStarting(true);
    setError(null);
    try {
      const created = await createAssessment({
        type,
        revieweeId,
        companyId,
        cycleId: cycle?.id,
      });
      router.push(`/my-companies/${companyId}/assessments/${created.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không bắt đầu được đánh giá',
      );
      setStarting(false);
    }
  };

  return (
    <PageContainer>
        <PageHeader
          title="Đánh giá chéo"
          subtitle="Tự đánh giá hàng tháng, đánh giá đồng nghiệp, và hồ sơ đi cùng bạn."
          actions={
            isAdmin ? (
              <Button
                component={NextLink}
                href="/settings/assessment-templates"
                variant="outlined"
                startIcon={<SettingsOutlinedIcon />}
              >
                Cài đặt tiêu chí
              </Button>
            ) : undefined
          }
        />

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : null}
        {loading ? (
          <PageSkeleton variant="cards" />
        ) : (
          <>
        <Card title="Kỳ hiện tại" sx={{ mb: 3 }}>
          {!cycle ? (
            <Typography variant="body2">
              Hiện chưa có kỳ đánh giá đang mở.
              {isAdmin
                ? ' Mở một kỳ từ Cài đặt tiêu chí để mọi người bắt đầu tự đánh giá.'
                : ' Quản trị sẽ mở kỳ khi vòng đánh giá bắt đầu.'}
            </Typography>
          ) : (
            <>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{
                  alignItems: { sm: 'center' },
                  justifyContent: 'space-between',
                }}
              >
                <Box>
                  <Typography variant="h3">
                    {cycle.name}{' '}
                    <Chip label={cycle.period} size="small" sx={{ ml: 0.5 }} />
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    Thang điểm: {cycle.template.name}
                    {cycle.dueDate
                      ? ` · hạn ${new Date(cycle.dueDate).toLocaleDateString('vi-VN')}`
                      : ''}
                  </Typography>
                </Box>
                {openSelfDraft ? (
                  <Button
                    component={NextLink}
                    href={`/my-companies/${companyId}/assessments/${openSelfDraft.id}`}
                    variant="contained"
                  >
                    Tiếp tục tự đánh giá
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={() => startAssessment('SELF')}
                    disabled={starting}
                  >
                    {starting ? 'Đang bắt đầu...' : 'Bắt đầu tự đánh giá'}
                  </Button>
                )}
              </Stack>

              {colleagues.length > 0 ? (
                <>
                  <Divider sx={{ my: 2.5 }} />
                  <Typography variant="body2" sx={{ mb: 1.5 }}>
                    Đánh giá đồng nghiệp
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      select
                      label="Đồng nghiệp"
                      value={colleagueId}
                      onChange={(e) => setColleagueId(e.target.value)}
                      sx={{ minWidth: 260 }}
                      size="small"
                    >
                      {colleagues.map((colleague) => (
                        <MenuItem key={colleague.id} value={colleague.id}>
                          {colleague.name}
                          {colleague.jobTitle ? ` — ${colleague.jobTitle}` : ''}
                        </MenuItem>
                      ))}
                    </TextField>
                    <Box>
                      <Button
                        variant="outlined"
                        disabled={!colleagueId || starting}
                        onClick={() => startAssessment('PEER', colleagueId)}
                      >
                        Bắt đầu đánh giá
                      </Button>
                    </Box>
                  </Stack>
                </>
              ) : null}
            </>
          )}
        </Card>

        {isAdmin ? (
          <Card title={`Chờ duyệt (${pending.length})`} sx={{ mb: 3 }}>
            <AssessmentList
              items={pending}
              companyId={companyId}
              emptyText="Hiện không có bài nào chờ bạn duyệt."
              nameOf={(a) => `${a.reviewee.name} · bởi ${a.reviewer.name}`}
            />
          </Card>
        ) : null}

        <Card title="Về tôi" sx={{ mb: 3 }}>
          <AssessmentList
            items={received}
            companyId={companyId}
            emptyText="Chưa ai đánh giá bạn."
            nameOf={(a) => `${a.reviewer.name} → bạn`}
          />
        </Card>

        <Card title="Tôi đã viết">
          <AssessmentList
            items={given}
            companyId={companyId}
            emptyText="Bạn chưa viết đánh giá nào."
            nameOf={(a) =>
              a.type === 'SELF' ? 'Tự đánh giá' : `Về ${a.reviewee.name}`
            }
          />
        </Card>
          </>
        )}
    </PageContainer>
  );
}

function AssessmentList({
  items,
  companyId,
  emptyText,
  nameOf,
}: {
  items: AssessmentListItem[];
  companyId: string;
  emptyText: string;
  nameOf: (item: AssessmentListItem) => string;
}) {
  if (items.length === 0) {
    return <Typography variant="body2">{emptyText}</Typography>;
  }

  return (
    <Stack divider={<Divider />} spacing={1.5}>
      {items.map((item) => (
        <Box
          key={item.id}
          sx={{
            pt: 1,
            display: 'flex',
            alignItems: { sm: 'center' },
            justifyContent: 'space-between',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {nameOf(item)}
            </Typography>
            <Typography variant="body2">
              {item.cycle ? `${item.cycle.name} · ${item.cycle.period}` : 'Không thuộc kỳ'}
              {item.mood ? ` · tâm trạng: ${MOOD_LABEL[item.mood] ?? item.mood}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {item.totalScore !== null ? (
              <Chip label={`${item.totalScore}/10`} size="small" color="primary" />
            ) : null}
            <Chip
              label={ASSESSMENT_STATUS_LABEL[item.status] ?? item.status}
              size="small"
              color={STATUS_TONE[item.status]}
            />
            <Button
              component={NextLink}
              href={`/my-companies/${companyId}/assessments/${item.id}`}
              size="small"
            >
              Mở
            </Button>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
