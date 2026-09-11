'use client';

import * as React from 'react';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import StatusChip from '@/components/ui/StatusChip';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import {
  listActivityLogs,
  createActivityLog,
  updateActivityLog,
  deleteActivityLog,
  type ActivityLog,
} from '@/lib/api/activityLogsApi';
import { ApiError } from '@/lib/api/client';

const CATEGORY_OPTIONS = ['Hobby', 'Volunteer', 'Certification', 'Other'];

function toDateInputValue(iso: string): string {
  // Truncate an ISO datetime down to the yyyy-MM-dd an <input type="date">
  // needs; a date-only string already looks like this and slices as a
  // no-op.
  return iso.slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

interface FormState {
  title: string;
  category: string;
  date: string;
  description: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  category: '',
  date: new Date().toISOString().slice(0, 10),
  description: '',
};

export default function ActivityLogPage() {
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Plain .then/.catch/.finally (not async/await) so no setState call
  // happens synchronously inside the mount effect below — everything here
  // resolves in a promise callback instead, same shape AuthContext's own
  // mount-effect fetch uses (see contexts/AuthContext.tsx).
  const loadLogs = React.useCallback(() => {
    return listActivityLogs()
      .then((data) => {
        setLogs(data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Failed to load activity log.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleFieldChange = (field: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleEdit = (log: ActivityLog) => {
    setEditingId(log.id);
    setForm({
      title: log.title,
      category: log.category ?? '',
      date: toDateInputValue(log.date),
      description: log.description ?? '',
    });
    setFormError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteActivityLog(id);
      setLogs((prev) => prev.filter((entry) => entry.id !== id));
      if (editingId === id) {
        handleCancelEdit();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete entry.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.date) {
      setFormError('Title and date are required.');
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category || undefined,
        date: form.date,
      };

      if (editingId) {
        const updated = await updateActivityLog(editingId, payload);
        setLogs((prev) => prev.map((entry) => (entry.id === editingId ? updated : entry)));
      } else {
        const created = await createActivityLog(payload);
        setLogs((prev) => [created, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)));
      }
      handleCancelEdit();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Activity Log" subtitle="Life & work activities you have logged." />

        <Card title={editingId ? 'Edit activity' : 'Log an activity'} sx={{ mb: 3 }}>
          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              {formError ? <Alert severity="error">{formError}</Alert> : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Title"
                  value={form.title}
                  onChange={handleFieldChange('title')}
                  fullWidth
                  required
                />
                <TextField
                  select
                  label="Category"
                  value={form.category}
                  onChange={handleFieldChange('category')}
                  sx={{ minWidth: { sm: 200 } }}
                  fullWidth
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {CATEGORY_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={handleFieldChange('date')}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={{ minWidth: { sm: 180 } }}
                  required
                />
              </Stack>
              <TextField
                label="Description"
                value={form.description}
                onChange={handleFieldChange('description')}
                multiline
                minRows={3}
                fullWidth
              />
              <Stack direction="row" spacing={1.5}>
                <Button type="submit" variant="contained" disabled={saving}>
                  {editingId ? 'Save changes' : 'Add activity'}
                </Button>
                {editingId ? (
                  <Button variant="text" onClick={handleCancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </Box>
        </Card>

        <Card title="Your activities">
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          {loading ? (
            <Typography variant="body2">Loading…</Typography>
          ) : logs.length === 0 ? (
            <Typography variant="body2">No activities logged yet — add your first one above.</Typography>
          ) : (
            <Stack divider={<Divider />} spacing={2}>
              {logs.map((log) => (
                <Box
                  key={log.id}
                  sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}
                >
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack
                      direction="row"
                      spacing={1}
                      sx={{ mb: 0.5, alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Typography variant="h3">{log.title}</Typography>
                      {log.category ? <StatusChip label={log.category} tone="info" /> : null}
                      <Typography variant="body2">{formatDisplayDate(log.date)}</Typography>
                    </Stack>
                    {log.description ? (
                      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                        {log.description}
                      </Typography>
                    ) : null}
                  </Box>
                  <Stack direction="row" spacing={0.5}>
                    <IconButton size="small" onClick={() => handleEdit(log)} aria-label="Edit activity">
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" onClick={() => void handleDelete(log.id)} aria-label="Delete activity">
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Card>
      </PageContainer>
    </AppShell>
  );
}
