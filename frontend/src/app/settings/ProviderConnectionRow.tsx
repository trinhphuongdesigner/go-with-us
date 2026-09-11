'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@/components/ui/Button';
import StatusChip from '@/components/ui/StatusChip';
import * as aiSettingsApi from '@/lib/api/aiSettingsApi';
import { ApiError } from '@/lib/api/client';
import type { AiProvider, AiSetting } from '@/types';
import { colorTokens } from '@/theme/theme';

interface ProviderConnectionRowProps {
  provider: AiProvider;
  label: string;
  setting: AiSetting;
  onChanged: (setting: AiSetting) => void;
}

/**
 * One row of the "API Keys & Connections" card — exactly the shape
 * D:\Coding\AI_Tool\docs\new-project-prompt-template.md section A
 * describes: masked key input, optional baseUrl/model override, Save/
 * Disconnect. GET never returns the real key (see AiSettingsService on the
 * backend) — the key field always starts blank; a saved connection is
 * only signaled via the "Connected" chip, never by prefilling the input.
 */
export default function ProviderConnectionRow({
  provider,
  label,
  setting,
  onChanged,
}: ProviderConnectionRowProps) {
  const [apiKey, setApiKey] = React.useState('');
  const [baseUrl, setBaseUrl] = React.useState(setting.baseUrl ?? '');
  const [model, setModel] = React.useState(setting.model ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Cần API key để lưu kết nối');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const updated = await aiSettingsApi.upsertAiSetting(provider, {
        apiKey,
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
      });
      onChanged(updated);
      setApiKey('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được kết nối');
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setError(null);
    setSaving(true);
    try {
      await aiSettingsApi.deleteAiSetting(provider);
      onChanged({ provider, hasKey: false, baseUrl: null, model: null });
      setApiKey('');
      setBaseUrl('');
      setModel('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không ngắt được kết nối');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'stretch', md: 'flex-start' },
        gap: { xs: 1.5, md: 2.5 },
        py: 2.5,
        borderTop: `1px solid ${colorTokens.divider}`,
        '&:first-of-type': { borderTop: 'none' },
      }}
    >
      <Box sx={{ flex: { md: '0 0 200px' } }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500, mb: 0.75 }}>{label}</Typography>
        <StatusChip label={setting.hasKey ? 'Đã kết nối' : 'Chưa kết nối'} tone={setting.hasKey ? 'success' : 'neutral'} />
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <TextField
          type="password"
          placeholder={setting.hasKey ? 'Để trống nếu giữ key hiện tại' : 'API key (ví dụ sk-...)'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          placeholder="Base URL (tuỳ chọn)"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          placeholder="Model (tuỳ chọn)"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          fullWidth
          size="small"
        />
        {error ? (
          <Typography variant="body2" sx={{ color: colorTokens.danger }}>
            {error}
          </Typography>
        ) : null}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
          Lưu
        </Button>
        <Button variant="outlined" size="small" onClick={handleDisconnect} disabled={saving || !setting.hasKey}>
          Ngắt kết nối
        </Button>
      </Box>
    </Box>
  );
}
