'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import PageSkeleton from '@/components/ui/PageSkeleton';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import * as usersApi from '@/lib/api/usersApi';
import { ApiError } from '@/lib/api/client';
import type { User } from '@/types';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = React.useState<User[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    usersApi
      .listUsers()
      .then((users) => setEmployees(users.filter((u) => u.role === 'EMPLOYEE')))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được danh sách nhân sự');
      });
  }, []);

  return (
    <PageContainer>
        <PageHeader title="Nhân sự" subtitle="Đội ngũ của công ty bạn." />
        <Card title="Nhân sự">
          {error ? (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          ) : !employees ? (
            <PageSkeleton variant="table" rows={5} embedded />
          ) : employees.length === 0 ? (
            <Typography variant="body1">Chưa có nhân sự nào.</Typography>
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
