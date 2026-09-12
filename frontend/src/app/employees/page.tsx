'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import ViewToggle, { type ViewMode } from '@/components/ui/ViewToggle';
import { colorTokens, radiusTokens } from '@/theme/theme';
import * as usersApi from '@/lib/api/usersApi';
import { ApiError } from '@/lib/api/client';
import { isEmployeeRole } from '@/lib/roles';
import type { User } from '@/types';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = React.useState<User[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>('list');

  React.useEffect(() => {
    usersApi
      .listUsers()
      .then((users) => setEmployees(users.filter((u) => isEmployeeRole(u.role))))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được danh sách nhân sự');
      });
  }, []);

  return (
    <PageContainer>
        <PageHeader title="Nhân sự" subtitle="Đội ngũ của công ty bạn." />
        <Card title="Nhân sự" actions={<ViewToggle value={viewMode} onChange={setViewMode} />}>
          {error ? (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          ) : !employees ? (
            <PageSkeleton variant={viewMode === 'card' ? 'cards' : 'table'} rows={5} embedded />
          ) : employees.length === 0 ? (
            <Typography variant="body1">Chưa có nhân sự nào.</Typography>
          ) : viewMode === 'card' ? (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 2,
              }}
            >
              {employees.map((employee) => (
                <Box
                  key={employee.id}
                  onClick={() => router.push(`/employees/${employee.id}`)}
                  sx={{
                    border: `1px solid ${colorTokens.border}`,
                    borderRadius: `${radiusTokens.md}px`,
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    gap: 0.5,
                    cursor: 'pointer',
                    transition: 'border-color 0.15s ease',
                    '&:hover': { borderColor: colorTokens.primary },
                  }}
                >
                  <Avatar
                    src={employee.avatarUrl ?? undefined}
                    sx={{ width: 48, height: 48, bgcolor: colorTokens.primary, color: '#ffffff' }}
                  >
                    {employee.name?.[0]?.toUpperCase() ?? '?'}
                  </Avatar>
                  <Typography variant="body1" sx={{ fontWeight: 600, mt: 1 }}>
                    {employee.name}
                  </Typography>
                  <Typography variant="body2">{employee.jobTitle ?? 'Chưa có chức danh'}</Typography>
                  <Box sx={{ display: 'flex', gap: 2, mt: 1, fontSize: 12, color: colorTokens.secondary }}>
                    <span>Đóng góp: {employee.contributionScore ?? '—'}</span>
                    <span>Thái độ: {employee.attitudeScore ?? '—'}</span>
                  </Box>
                </Box>
              ))}
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tên</TableCell>
                  <TableCell>Chức danh</TableCell>
                  <TableCell>Điểm đóng góp</TableCell>
                  <TableCell>Điểm thái độ</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow
                    key={employee.id}
                    onClick={() => router.push(`/employees/${employee.id}`)}
                    hover
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>{employee.name}</TableCell>
                    <TableCell>{employee.jobTitle ?? '—'}</TableCell>
                    <TableCell>{employee.contributionScore ?? '—'}</TableCell>
                    <TableCell>{employee.attitudeScore ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
    </PageContainer>
  );
}
