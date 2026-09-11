import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';

export default function SkillsPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="My Skills" subtitle="Skills you have logged." />
        <Card title="Coming soon">
          <Typography variant="body1">
            Self-assessed and admin-reviewed skill tracking lands in a later phase.
          </Typography>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
