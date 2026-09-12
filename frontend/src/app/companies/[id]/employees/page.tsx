'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Typography from '@mui/material/Typography';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import PageSkeleton from '@/components/ui/PageSkeleton';
import StatusChip from '@/components/ui/StatusChip';
import * as usersApi from '@/lib/api/usersApi';
import { ROLE_LABEL } from '@/lib/labels';
import type { User } from '@/types';
import { useCompanyScope } from '../CompanyScopeContext';
import { isEmployeeRole } from '@/lib/roles';

export default function CompanyEmployeesPage() {
  const router = useRouter();
  const { companyId, company } = useCompanyScope();
  const [members, setMembers] = React.useState<User[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    usersApi
      .listUsers()
      .then((users) => setMembers(users.filter((u) => u.companyId === companyId)))
      .catch(() => setError('Không tải được danh sách nhân sự'));
  }, [companyId]);

  return (
    <PageContainer>
      <PageHeader title="Nhân sự" subtitle={company ? `Đội ngũ của ${company.name}.` : undefined} />
      <Card title="Thành viên">
        {error ? (
          <Typography variant="body2" sx={{ color: 'error.main' }}>
            {error}
          </Typography>
        ) : !members ? (
          <PageSkeleton variant="table" rows={5} embedded />
        ) : members.length === 0 ? (
          <Typography variant="body1">Chưa có thành viên nào.</Typography>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Tên</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Vai trò</TableCell>
                <TableCell>Chức danh</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map((member) => {
                const clickable = isEmployeeRole(member.role);
                return (
                  <TableRow
                    key={member.id}
                    hover={clickable}
                    sx={clickable ? { cursor: 'pointer' } : undefined}
                    onClick={clickable ? () => router.push(`/employees/${member.id}`) : undefined}
                  >
                    <TableCell>{member.name}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <StatusChip
                        label={ROLE_LABEL[member.role] ?? member.role}
                        tone={member.role === 'COMPANY_ADMIN' ? 'info' : 'neutral'}
                      />
                    </TableCell>
                    <TableCell>{member.jobTitle ?? '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageContainer>
  );
}
