'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import PageSkeleton from '@/components/ui/PageSkeleton';
import StatusChip from '@/components/ui/StatusChip';
import * as usersApi from '@/lib/api/usersApi';
import { formatDate } from '@/lib/labels';
import type { User } from '@/types';
import { useCompanyScope } from './CompanyScopeContext';

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="body2">{label}</Typography>
      <Typography variant="h2">{value}</Typography>
    </Box>
  );
}

/**
 * Tổng quan — landing tab when entering a company from /companies. UI mock:
 * employee/admin counts come from the real roster, everything else here is
 * a placeholder pending real assessment/request data (see /assessments and
 * /requests siblings for the same caveat).
 */
export default function CompanyDashboardPage() {
  const { companyId, company, error } = useCompanyScope();
  const [members, setMembers] = React.useState<User[] | null>(null);

  React.useEffect(() => {
    usersApi
      .listUsers()
      .then((users) => setMembers(users.filter((u) => u.companyId === companyId)))
      .catch(() => setMembers([]));
  }, [companyId]);

  const employeeCount = members?.filter((m) => m.role === 'EMPLOYEE').length ?? null;
  const adminCount = members?.filter((m) => m.role === 'COMPANY_ADMIN').length ?? null;

  return (
    <PageContainer>
      <PageHeader
        title={company?.name ?? 'Tổng quan công ty'}
        subtitle={company ? `Tạo ngày ${formatDate(company.createdAt)}` : undefined}
      />

      {error ? (
        <Card>
          <Typography variant="body1" sx={{ color: 'error.main' }}>
            {error}
          </Typography>
        </Card>
      ) : !company ? (
        <PageSkeleton variant="cards" />
      ) : (
        <Stack spacing={3}>
          <Card title="Chỉ số nhanh">
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={4} sx={{ flexWrap: 'wrap' }}>
              <StatTile label="Nhân sự" value={employeeCount ?? '—'} />
              <StatTile label="Quản trị viên" value={adminCount ?? '—'} />
              <StatTile label="Đánh giá đang chờ duyệt" value="—" />
              <StatTile label="Yêu cầu đang chờ duyệt" value="—" />
            </Stack>
          </Card>

          <Card
            title="Hoạt động gần đây"
            actions={<StatusChip label="Giao diện minh hoạ" tone="neutral" />}
          >
            <Typography variant="body2">
              Khu vực này sẽ hiển thị hoạt động thực tế của công ty (đánh giá vừa duyệt, yêu cầu mới, nhân
              sự mới tham gia…) khi được nối dữ liệu ở bản cập nhật tiếp theo.
            </Typography>
          </Card>
        </Stack>
      )}
    </PageContainer>
  );
}
