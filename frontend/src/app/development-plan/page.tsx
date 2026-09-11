import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';

export default function DevelopmentPlanPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Development Plan" subtitle="Your personal growth roadmap." />
        <Card title="Coming soon">
          <Typography variant="body1">
            AI-assisted development plan generation lands in a later phase.
          </Typography>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
