'use client';

import * as React from 'react';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import ProviderConnectionRow from './ProviderConnectionRow';
import * as aiSettingsApi from '@/lib/api/aiSettingsApi';
import { useAuth } from '@/contexts/AuthContext';
import type { AiProvider, AiSetting } from '@/types';

const PROVIDER_LABELS: Record<AiProvider, string> = {
  ANTHROPIC: 'Anthropic (Claude)',
  OPENAI: 'OpenAI (ChatGPT)',
  GEMINI: 'Gemini (Google)',
};
const PROVIDER_ORDER: AiProvider[] = ['ANTHROPIC', 'OPENAI', 'GEMINI'];

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = React.useState<Record<AiProvider, AiSetting> | null>(null);

  React.useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN') return;
    aiSettingsApi.listAiSettings().then((list) => {
      const byProvider = Object.fromEntries(list.map((s) => [s.provider, s])) as Record<AiProvider, AiSetting>;
      setSettings(byProvider);
    });
  }, [user]);

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Settings" subtitle="Platform-level configuration." />

        {user?.role !== 'SUPER_ADMIN' ? (
          <Card title="API Keys & Connections">
            <Typography variant="body1">
              Only Super Admins can manage AI provider connections.
            </Typography>
          </Card>
        ) : !settings ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Card title="API Keys & Connections">
            {PROVIDER_ORDER.map((provider) => (
              <ProviderConnectionRow
                key={provider}
                provider={provider}
                label={PROVIDER_LABELS[provider]}
                setting={settings[provider]}
                onChanged={(updated) => setSettings((prev) => (prev ? { ...prev, [provider]: updated } : prev))}
              />
            ))}
          </Card>
        )}
      </PageContainer>
    </AppShell>
  );
}
