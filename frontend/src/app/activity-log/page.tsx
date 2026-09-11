import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';

export default function ActivityLogPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Activity Log" subtitle="Life & work activities you have logged." />
        <Card title="Coming soon">
          <Typography variant="body1">
            Activity logging (used to power AI-suggested development plans) lands in a later phase.
          </Typography>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
