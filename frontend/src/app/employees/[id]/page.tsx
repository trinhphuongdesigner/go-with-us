'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import StatusChip from '@/components/ui/StatusChip';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Rating from '@mui/material/Rating';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import * as skillsCompetencyApi from '@/lib/api/skillsCompetencyApi';
import type { CompetencyInsight } from '@/lib/api/skillsCompetencyApi';
import { ApiError } from '@/lib/api/client';

const GOAL_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  ACHIEVED: 'Achieved',
};

export default function EmployeeInsightPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params.id;

  const [insight, setInsight] = React.useState<CompetencyInsight | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    skillsCompetencyApi
      .getInsight(userId)
      .then(setInsight)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load competency insight');
      });
  }, [userId]);

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title={insight ? insight.profile.name : 'Employee insight'}
          subtitle={insight?.profile.jobTitle ?? undefined}
          actions={
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ArrowBackOutlinedIcon fontSize="small" />}
                onClick={() => router.push('/employees')}
              >
                Back to employees
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => router.push(`/employees/${params.id}/passport`)}
              >
                Career passport
              </Button>
            </>
          }
        />

        {error ? (
          <Card title="Competency insight">
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          </Card>
        ) : !insight ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={3}>
            <Card title="Profile & scores">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
                <Box>
                  <Typography variant="body2">Contribution score</Typography>
                  <Typography variant="h2">{insight.profile.contributionScore ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2">Attitude score</Typography>
                  <Typography variant="h2">{insight.profile.attitudeScore ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2">Activity log entries</Typography>
                  <Typography variant="h2">{insight.activityCount}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2">Peer reviews received</Typography>
                  <Typography variant="h2">{insight.peerReviewReceivedCount}</Typography>
                </Box>
              </Stack>
            </Card>

            <Card title="Development goals">
              {Object.keys(insight.goalStatusCounts).length === 0 ? (
                <Typography variant="body1">No development goals yet.</Typography>
              ) : (
                <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                  {Object.entries(insight.goalStatusCounts).map(([status, count]) => (
                    <StatusChip key={status} label={`${GOAL_STATUS_LABELS[status] ?? status}: ${count}`} tone={status === 'ACHIEVED' ? 'success' : status === 'IN_PROGRESS' ? 'info' : 'neutral'} />
                  ))}
                </Stack>
              )}
            </Card>

            <Card title="Skills">
              {insight.skills.length === 0 ? (
                <Typography variant="body1">No skills logged yet.</Typography>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Skill</TableCell>
                      <TableCell>Level</TableCell>
                      <TableCell>Self-assessed</TableCell>
                      <TableCell>Note</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {insight.skills.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.skill.name}</TableCell>
                        <TableCell>
                          <Rating value={row.level} max={5} readOnly size="small" />
                        </TableCell>
                        <TableCell>{row.selfAssessed ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{row.note ?? '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </Stack>
        )}
      </PageContainer>
    </AppShell>
  );
}
