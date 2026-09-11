import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';

export default function ProfilePage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="My Profile" subtitle="Your own competency profile." />
        <Card title="Coming soon">
          <Typography variant="body1">
            Experience, competency, and skill self-management lands in a later phase.
          </Typography>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
