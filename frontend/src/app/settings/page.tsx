'use client';

import * as React from 'react';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Typography from '@mui/material/Typography';
import PageSkeleton from '@/components/ui/PageSkeleton';
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
    <PageContainer>
        <PageHeader title="Cài đặt" subtitle="Cấu hình cấp nền tảng." />

        {user?.role !== 'SUPER_ADMIN' ? (
          <Card title="Không có quyền truy cập">
            <Typography variant="body1">
              Trang này chỉ dành cho quản trị nền tảng (Super Admin). Bạn không có quyền xem hoặc
              chỉnh sửa cấu hình cấp nền tảng.
            </Typography>
          </Card>
        ) : !settings ? (
          <PageSkeleton variant="form" />
        ) : (
          <Card title="API Key & kết nối">
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
  );
}
