'use client';

import * as React from 'react';
import Card from '@/components/ui/Card';
import StatusChip from '@/components/ui/StatusChip';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@/components/ui/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@/components/ui/IconButton';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
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

const CATEGORY_OPTIONS = ['Sở thích', 'Tình nguyện', 'Chứng chỉ', 'Khác'];

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

function formatDisplayDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' });
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

export default function ActivityTab() {
  const { ask, dialog } = useConfirmDialog();
  const [logs, setLogs] = React.useState<ActivityLog[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const loadLogs = React.useCallback(() => {
    return listActivityLogs()
      .then((data) => {
        setLogs(data);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : 'Không tải được nhật ký hoạt động.');
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
      setError(err instanceof ApiError ? err.message : 'Không xóa được mục này.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.title.trim() || !form.date) {
      setFormError('Cần có tiêu đề và ngày.');
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
      setFormError(err instanceof ApiError ? err.message : 'Không lưu được mục này.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <Card title={editingId ? 'Sửa hoạt động' : 'Ghi nhận hoạt động'} sx={{ mb: 3 }}>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack spacing={2}>
            {formError ? <Alert severity="error">{formError}</Alert> : null}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Tiêu đề"
                value={form.title}
                onChange={handleFieldChange('title')}
                fullWidth
                required
              />
              <TextField
                select
                label="Danh mục"
                value={form.category}
                onChange={handleFieldChange('category')}
                sx={{ minWidth: { sm: 200 } }}
                fullWidth
              >
                <MenuItem value="">
                  <em>Không chọn</em>
                </MenuItem>
                {CATEGORY_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Ngày"
                type="date"
                value={form.date}
                onChange={handleFieldChange('date')}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: { sm: 180 } }}
                required
              />
            </Stack>
            <TextField
              label="Mô tả"
              value={form.description}
              onChange={handleFieldChange('description')}
              multiline
              minRows={3}
              fullWidth
            />
            <Stack direction="row" spacing={1.5}>
              <Button type="submit" variant="contained" disabled={saving}>
                {editingId ? 'Lưu thay đổi' : 'Thêm hoạt động'}
              </Button>
              {editingId ? (
                <Button variant="text" onClick={handleCancelEdit} disabled={saving}>
                  Hủy
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Box>
      </Card>

      <Card title="Hoạt động của bạn">
        {error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}
        {loading ? (
          <PageSkeleton variant="list" rows={4} embedded />
        ) : logs.length === 0 ? (
          <Typography variant="body2">Chưa có hoạt động nào — thêm mục đầu tiên ở trên.</Typography>
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
                  <IconButton size="sm" onClick={() => handleEdit(log)} aria-label="Sửa hoạt động">
                    <EditOutlinedIcon />
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label="Xóa hoạt động"
                    onClick={() =>
                      ask({
                        title: 'Xóa hoạt động',
                        description: `Xóa “${log.title}”? Hành động này không thể hoàn tác.`,
                        confirmLabel: 'Xóa',
                        danger: true,
                        onConfirm: () => handleDelete(log.id),
                      })
                    }
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Card>
      {dialog}
    </Box>
  );
}
