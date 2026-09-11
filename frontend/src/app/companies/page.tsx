import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';

export default function CompaniesPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Companies" subtitle="Every company on the platform." />
        <Card title="Coming soon">
          <Typography variant="body1">
            Company list/detail management (Super Admin only) lands in a later phase — create/edit a Company + its Company Admin.
          </Typography>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
