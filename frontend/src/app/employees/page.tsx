'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
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
        setError(err instanceof ApiError ? err.message : 'Failed to load employees');
      });
  }, []);

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Employees" subtitle="Your company's workforce." />
        <Card title="Employees">
          {error ? (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {error}
            </Typography>
          ) : !employees ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : employees.length === 0 ? (
            <Typography variant="body1">No employees yet.</Typography>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Job title</TableCell>
                  <TableCell>Contribution score</TableCell>
                  <TableCell>Attitude score</TableCell>
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
    </AppShell>
  );
}
