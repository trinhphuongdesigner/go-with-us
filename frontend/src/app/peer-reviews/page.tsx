import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';

export default function PeerReviewsPage() {
  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Peer Reviews" subtitle="Reviews you have given and received." />
        <Card title="Coming soon">
          <Typography variant="body1">
            Peer-to-peer review flows land in a later phase.
          </Typography>
        </Card>
      </PageContainer>
    </AppShell>
  );
}
