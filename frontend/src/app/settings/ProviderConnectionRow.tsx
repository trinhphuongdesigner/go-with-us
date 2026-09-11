'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
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
      setError('API key is required to save a connection');
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
      setError(err instanceof ApiError ? err.message : 'Failed to save connection');
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
      setError(err instanceof ApiError ? err.message : 'Failed to disconnect');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ py: 2.5, borderBottom: `1px solid ${colorTokens.divider}`, '&:last-of-type': { borderBottom: 'none' } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography variant="h3" sx={{ flex: 1 }}>
          {label}
        </Typography>
        <StatusChip label={setting.hasKey ? 'Connected' : 'Not connected'} tone={setting.hasKey ? 'success' : 'neutral'} />
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <TextField
          label="API key"
          type="password"
          placeholder={setting.hasKey ? 'Leave blank to keep current key' : 'sk-...'}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label="Base URL (optional)"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          fullWidth
          size="small"
        />
        <TextField
          label="Model (optional)"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          fullWidth
          size="small"
        />
      </Stack>

      {error ? (
        <Typography variant="body2" sx={{ color: colorTokens.danger, mt: 1 }}>
          {error}
        </Typography>
      ) : null}

      <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
        <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
          Save
        </Button>
        <Button variant="outlined" size="small" onClick={handleDisconnect} disabled={saving || !setting.hasKey}>
          Disconnect
        </Button>
      </Stack>
    </Box>
  );
}
