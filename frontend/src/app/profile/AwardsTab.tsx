'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { ApiError } from '@/lib/api/client';
import {
  createAward,
  deleteAward,
  updateAward,
  type Award,
  type LifeCategory,
} from '@/lib/api/competencyProfileApi';

interface FormState {
  title: string;
  category: LifeCategory;
  issuer: string;
  description: string;
  evidenceUrl: string;
  awardedAt: string;
}

const EMPTY: FormState = {
  title: '',
  category: 'WORK',
  issuer: '',
  description: '',
  evidenceUrl: '',
  awardedAt: '',
};

const toInputDate = (value: string | null) => (value ? value.slice(0, 10) : '');

/**
 * Awards and competitions, work and personal alike — the point of the idea
 * doc's "nhân viên tự ghi nhận" is that this does not wait for HR to enter
 * it, so everything here is self-reported with an optional evidence link.
 */
export default function AwardsTab({
  awards,
  onChanged,
}: {
  awards: Award[];
  onChanged: () => void;
}) {
  const { ask, dialog } = useConfirmDialog();
  const [open, setOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  };

  const openEdit = (award: Award) => {
    setEditingId(award.id);
    setForm({
      title: award.title,
      category: award.category,
      issuer: award.issuer ?? '',
      description: award.description ?? '',
      evidenceUrl: award.evidenceUrl ?? '',
      awardedAt: toInputDate(award.awardedAt),
    });
    setError(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError('Cần có tiêu đề.');
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      category: form.category,
      issuer: form.issuer.trim() || undefined,
      description: form.description.trim() || undefined,
      evidenceUrl: form.evidenceUrl.trim() || undefined,
      awardedAt: form.awardedAt
        ? new Date(form.awardedAt).toISOString()
        : undefined,
    };

    try {
      if (editingId) {
        await updateAward(editingId, payload);
      } else {
        await createAward(payload);
      }
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được thành tích');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAward(id);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không xóa được thành tích');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={openCreate}>
          Thêm thành tích
        </Button>
      </Box>

      {error && !open ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {awards.length === 0 ? (
        <Typography variant="body2">
          Chưa có thành tích. Cả công việc (nhân viên xuất sắc, hackathon nội bộ)
          và cá nhân (thể thao, tình nguyện) đều ghi ở đây.
        </Typography>
      ) : (
        <Stack divider={<Divider />} spacing={2}>
          {awards.map((award) => (
            <Box
              key={award.id}
              sx={{
                pt: 1,
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                flexDirection: { xs: 'column', sm: 'row' },
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {award.title}
                  </Typography>
                  <Chip
                    label={award.category === 'WORK' ? 'Công việc' : 'Cá nhân'}
                    size="small"
                    color={award.category === 'WORK' ? 'primary' : 'default'}
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                </Stack>
                <Typography variant="body2">
                  {award.issuer ?? 'Tự ghi nhận'}
                  {award.awardedAt ? ` · ${toInputDate(award.awardedAt)}` : ''}
                </Typography>
                {award.description ? (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    {award.description}
                  </Typography>
                ) : null}
                {award.evidenceUrl ? (
                  <Link
                    href={award.evidenceUrl}
                    target="_blank"
                    rel="noopener"
                    variant="body2"
                  >
                    Xem minh chứng
                  </Link>
                ) : null}
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="sm" onClick={() => openEdit(award)}>
                  Sửa
                </Button>
                <Button
                  size="sm"
                  color="error"
                  onClick={() =>
                    ask({
                      title: 'Xóa thành tích',
                      description: `Xóa “${award.title}”? Hành động này không thể hoàn tác.`,
                      confirmLabel: 'Xóa',
                      danger: true,
                      onConfirm: () => handleDelete(award.id),
                    })
                  }
                >
                  Xóa
                </Button>
              </Stack>
            </Box>
          ))}
        </Stack>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? 'Sửa thành tích' : 'Thêm thành tích'}
        actions={
          <>
            <Button variant="text" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button variant="contained" onClick={handleSave} disabled={saving}>
              {saving ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </>
        }
      >
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Tiêu đề"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Danh mục"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as LifeCategory })
                }
                fullWidth
              >
                <MenuItem value="WORK">Công việc</MenuItem>
                <MenuItem value="PERSONAL">Cá nhân</MenuItem>
              </TextField>
              <TextField
                label="Ngày nhận"
                type="date"
                value={form.awardedAt}
                onChange={(e) => setForm({ ...form, awardedAt: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Stack>
            <TextField
              label="Đơn vị trao"
              value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              fullWidth
            />
            <TextField
              label="Mô tả"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="URL minh chứng"
              helperText="Link ảnh hoặc giấy chứng nhận"
              value={form.evidenceUrl}
              onChange={(e) => setForm({ ...form, evidenceUrl: e.target.value })}
              fullWidth
            />
          </Stack>
      </Dialog>
      {dialog}
    </Box>
  );
}
