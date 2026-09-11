import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';

export default function EmployeesPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Employees" subtitle="Your company's workforce." />
        <Card title="Coming soon">
          <Typography variant="body1">
            Employee roster, competency insight, and search/matching against job requirements land in a later phase.
          </Typography>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
