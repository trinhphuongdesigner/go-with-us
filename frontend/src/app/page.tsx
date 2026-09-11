'use client';

import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Dashboard" subtitle={`Welcome back${user ? `, ${user.name}` : ''}.`} />
        <Card title="Coming soon">
          <Typography variant="body1">
            Role-specific dashboard widgets (company overview for Super Admin, team insight for Company
            Admin, personal snapshot for Employee) land in a later phase.
          </Typography>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
