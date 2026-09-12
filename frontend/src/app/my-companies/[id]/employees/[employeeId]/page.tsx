'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import StatusChip from '@/components/ui/StatusChip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Stack from '@mui/material/Stack';
import SkillLevelMeter from '@/components/ui/SkillLevelMeter';
import Button from '@/components/ui/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import * as skillsCompetencyApi from '@/lib/api/skillsCompetencyApi';
import type { CompetencyInsight } from '@/lib/api/skillsCompetencyApi';
import { ApiError } from '@/lib/api/client';
import { GOAL_STATUS_LABEL } from '@/lib/labels';

export default function EmployeeInsightPage() {
  const params = useParams<{ id: string; employeeId: string }>();
  const router = useRouter();
  const userId = params.employeeId;

  const [insight, setInsight] = React.useState<CompetencyInsight | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!userId) return;
    skillsCompetencyApi
      .getInsight(userId)
      .then(setInsight)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được tổng quan năng lực');
      });
  }, [userId]);

  return (
    <PageContainer>
        <PageHeader
          title={insight ? insight.profile.name : 'Tổng quan nhân sự'}
          subtitle={insight?.profile.jobTitle ?? undefined}
          actions={
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<ArrowBackOutlinedIcon fontSize="small" />}
                onClick={() => router.push(`/my-companies/${params.id}/employees`)}
              >
                Quay lại nhân sự
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => router.push(`/my-companies/${params.id}/employees/${params.employeeId}/passport`)}
              >
                Hộ chiếu nghề nghiệp
              </Button>
            </>
          }
        />

        {error ? (
          <Card title="Tổng quan năng lực">
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          </Card>
        ) : !insight ? (
          <PageSkeleton variant="cards" />
        ) : (
          <Stack spacing={3}>
            <Card title="Hồ sơ & điểm">
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4}>
                <Box>
                  <Typography variant="body2">Điểm đóng góp</Typography>
                  <Typography variant="h2">{insight.profile.contributionScore ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2">Điểm thái độ</Typography>
                  <Typography variant="h2">{insight.profile.attitudeScore ?? '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2">Mục nhật ký hoạt động</Typography>
                  <Typography variant="h2">{insight.activityCount}</Typography>
                </Box>
                <Box>
                  <Typography variant="body2">Đánh giá đã nhận</Typography>
                  <Typography variant="h2">{insight.assessmentsReceivedCount}</Typography>
                </Box>
              </Stack>
            </Card>

            <Card title="Mục tiêu phát triển">
              {Object.keys(insight.goalStatusCounts).length === 0 ? (
                <Typography variant="body1">Chưa có mục tiêu phát triển.</Typography>
              ) : (
                <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
                  {Object.entries(insight.goalStatusCounts).map(([status, count]) => (
                    <StatusChip key={status} label={`${GOAL_STATUS_LABEL[status] ?? status}: ${count}`} tone={status === 'ACHIEVED' ? 'success' : status === 'IN_PROGRESS' ? 'info' : 'neutral'} />
                  ))}
                </Stack>
              )}
            </Card>

            <Card title="Kỹ năng">
              {insight.skills.length === 0 ? (
                <Typography variant="body1">Chưa ghi nhận kỹ năng nào.</Typography>
              ) : (
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Kỹ năng</TableCell>
                      <TableCell>Cấp độ</TableCell>
                      <TableCell>Tự đánh giá</TableCell>
                      <TableCell>Ghi chú</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {insight.skills.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{row.skill.name}</TableCell>
                        <TableCell>
                          <SkillLevelMeter value={row.level} size="sm" />
                        </TableCell>
                        <TableCell>{row.selfAssessed ? 'Có' : 'Không'}</TableCell>
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
  );
}
