'use client';

import * as React from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
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
 * M3 — the Cross Assessment hub. An employee lands here to do their monthly
 * self check-in and to assess colleagues; an admin also sees what is waiting
 * for approval.
 */
export default function AssessmentsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

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
        getActiveCycle(),
        listAssessments('received'),
        listAssessments('mine'),
        listUsers().catch(() => [] as User[]),
      ]);
      setCycle(activeCycle);
      setReceived(receivedList);
      setGiven(givenList);
      setColleagues(roster.filter((u) => u.id !== user?.id));
      if (isAdmin) {
        setPending(await listPendingApproval().catch(() => []));
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load assessments',
      );
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.id]);

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
        cycleId: cycle?.id,
      });
      router.push(`/assessments/${created.id}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to start assessment',
      );
      setStarting(false);
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Cross Assessment"
          subtitle="Your monthly check-in, colleague assessments, and the record that follows you."
          actions={
            isAdmin ? (
              <Button
                component={NextLink}
                href="/settings/assessment-templates"
                variant="outlined"
                startIcon={<SettingsOutlinedIcon />}
              >
                Criteria settings
              </Button>
            ) : undefined
          }
        />

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : null}
        {loading ? <LinearProgress sx={{ mb: 3 }} /> : null}

        <Card title="Current cycle" sx={{ mb: 3 }}>
          {!cycle ? (
            <Typography variant="body2">
              No open assessment cycle right now.
              {isAdmin
                ? ' Open one from Criteria settings to let people start checking in.'
                : ' Your admin opens one when the round starts.'}
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
                    Scale: {cycle.template.name}
                    {cycle.dueDate
                      ? ` · due ${new Date(cycle.dueDate).toLocaleDateString()}`
                      : ''}
                  </Typography>
                </Box>
                {openSelfDraft ? (
                  <Button
                    component={NextLink}
                    href={`/assessments/${openSelfDraft.id}`}
                    variant="contained"
                  >
                    Continue my check-in
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={() => startAssessment('SELF')}
                    disabled={starting}
                  >
                    {starting ? 'Starting...' : 'Start my check-in'}
                  </Button>
                )}
              </Stack>

              {colleagues.length > 0 ? (
                <>
                  <Divider sx={{ my: 2.5 }} />
                  <Typography variant="body2" sx={{ mb: 1.5 }}>
                    Assess a colleague
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <TextField
                      select
                      label="Colleague"
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
                        Start assessment
                      </Button>
                    </Box>
                  </Stack>
                </>
              ) : null}
            </>
          )}
        </Card>

        {isAdmin ? (
          <Card title={`Waiting for approval (${pending.length})`} sx={{ mb: 3 }}>
            <AssessmentList
              items={pending}
              emptyText="Nothing waiting on you right now."
              nameOf={(a) => `${a.reviewee.name} · by ${a.reviewer.name}`}
            />
          </Card>
        ) : null}

        <Card title="About me" sx={{ mb: 3 }}>
          <AssessmentList
            items={received}
            emptyText="No one has assessed you yet."
            nameOf={(a) => `${a.reviewer.name} → you`}
          />
        </Card>

        <Card title="Written by me">
          <AssessmentList
            items={given}
            emptyText="You have not written any assessment yet."
            nameOf={(a) =>
              a.type === 'SELF' ? 'Self check-in' : `About ${a.reviewee.name}`
            }
          />
        </Card>
      </PageContainer>
    </AppShell>
  );
}

function AssessmentList({
  items,
  emptyText,
  nameOf,
}: {
  items: AssessmentListItem[];
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
              {item.cycle ? `${item.cycle.name} · ${item.cycle.period}` : 'No cycle'}
              {item.mood ? ` · mood: ${item.mood}` : ''}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {item.totalScore !== null ? (
              <Chip label={`${item.totalScore}/10`} size="small" color="primary" />
            ) : null}
            <Chip
              label={item.status}
              size="small"
              color={STATUS_TONE[item.status]}
            />
            <Button
              component={NextLink}
              href={`/assessments/${item.id}`}
              size="small"
            >
              Open
            </Button>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
