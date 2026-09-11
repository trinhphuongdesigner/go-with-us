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
  createCertification,
  deleteCertification,
  updateCertification,
  type Certification,
  type CertificationType,
} from '@/lib/api/competencyProfileApi';

const TYPES: { value: CertificationType; label: string }[] = [
  { value: 'DEGREE', label: 'Bằng cấp' },
  { value: 'LANGUAGE', label: 'Ngoại ngữ' },
  { value: 'PROFESSIONAL', label: 'Chuyên môn' },
  { value: 'OTHER', label: 'Khác' },
];

interface FormState {
  name: string;
  issuer: string;
  type: CertificationType;
  score: string;
  issuedAt: string;
  expiresAt: string;
  credentialUrl: string;
}

const EMPTY: FormState = {
  name: '',
  issuer: '',
  type: 'PROFESSIONAL',
  score: '',
  issuedAt: '',
  expiresAt: '',
  credentialUrl: '',
};

const toInputDate = (value: string | null) => (value ? value.slice(0, 10) : '');

/** Degrees, language certificates (IELTS/TOEIC) and professional certs. */
export default function CertificationsTab({
  certifications,
  onChanged,
}: {
  certifications: Certification[];
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

  const openEdit = (certification: Certification) => {
    setEditingId(certification.id);
    setForm({
      name: certification.name,
      issuer: certification.issuer ?? '',
      type: certification.type,
      score: certification.score ?? '',
      issuedAt: toInputDate(certification.issuedAt),
      expiresAt: toInputDate(certification.expiresAt),
      credentialUrl: certification.credentialUrl ?? '',
    });
    setError(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Cần có tên chứng chỉ.');
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      issuer: form.issuer.trim() || undefined,
      type: form.type,
      score: form.score.trim() || undefined,
      issuedAt: form.issuedAt ? new Date(form.issuedAt).toISOString() : undefined,
      expiresAt: form.expiresAt
        ? new Date(form.expiresAt).toISOString()
        : undefined,
      credentialUrl: form.credentialUrl.trim() || undefined,
    };

    try {
      if (editingId) {
        await updateCertification(editingId, payload);
      } else {
        await createCertification(payload);
      }
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không lưu được chứng chỉ',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCertification(id);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không xóa được chứng chỉ',
      );
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={openCreate}>
          Thêm chứng chỉ
        </Button>
      </Box>

      {error && !open ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {certifications.length === 0 ? (
        <Typography variant="body2">
          Chưa có chứng chỉ — bằng cấp, điểm IELTS/TOEIC và chứng chỉ chuyên môn đều ở đây.
        </Typography>
      ) : (
        <Stack divider={<Divider />} spacing={2}>
          {certifications.map((certification) => (
            <Box
              key={certification.id}
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
                    {certification.name}
                  </Typography>
                  <Chip
                    label={TYPES.find((t) => t.value === certification.type)?.label ?? certification.type}
                    size="small"
                    variant="outlined"
                    sx={{ height: 20, fontSize: 11 }}
                  />
                </Stack>
                <Typography variant="body2">
                  {certification.issuer ?? 'Chưa rõ đơn vị cấp'}
                  {certification.score ? ` · ${certification.score}` : ''}
                  {certification.issuedAt
                    ? ` · cấp ngày ${toInputDate(certification.issuedAt)}`
                    : ''}
                </Typography>
                {certification.credentialUrl ? (
                  <Link
                    href={certification.credentialUrl}
                    target="_blank"
                    rel="noopener"
                    variant="body2"
                  >
                    Xem chứng chỉ
                  </Link>
                ) : null}
              </Box>
              <Stack direction="row" spacing={1}>
                <Button size="sm" onClick={() => openEdit(certification)}>
                  Sửa
                </Button>
                <Button
                  size="sm"
                  color="error"
                  onClick={() =>
                    ask({
                      title: 'Xóa chứng chỉ',
                      description: `Xóa “${certification.name}”? Hành động này không thể hoàn tác.`,
                      confirmLabel: 'Xóa',
                      danger: true,
                      onConfirm: () => handleDelete(certification.id),
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
        title={editingId ? 'Sửa chứng chỉ' : 'Thêm chứng chỉ'}
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
              label="Tên"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                select
                label="Loại"
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as CertificationType })
                }
                fullWidth
              >
                {TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Điểm"
                helperText="ví dụ IELTS 7.0, TOEIC 600"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                fullWidth
              />
            </Stack>
            <TextField
              label="Đơn vị cấp"
              value={form.issuer}
              onChange={(e) => setForm({ ...form, issuer: e.target.value })}
              fullWidth
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Ngày cấp"
                type="date"
                value={form.issuedAt}
                onChange={(e) => setForm({ ...form, issuedAt: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                label="Ngày hết hạn"
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Stack>
            <TextField
              label="URL chứng chỉ"
              value={form.credentialUrl}
              onChange={(e) =>
                setForm({ ...form, credentialUrl: e.target.value })
              }
              fullWidth
            />
          </Stack>
      </Dialog>
      {dialog}
    </Box>
  );
}
