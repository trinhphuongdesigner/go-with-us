'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@/components/ui/Button';
import Dialog from '@/components/ui/Dialog';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { ApiError } from '@/lib/api/client';
import {
  createProjectExperience,
  deleteProjectExperience,
  updateProjectExperience,
  type EmploymentEntry,
  type ProjectExperience,
} from '@/lib/api/competencyProfileApi';

interface FormState {
  name: string;
  role: string;
  domain: string;
  techStack: string;
  contribution: string;
  startDate: string;
  endDate: string;
  employmentId: string;
}

const EMPTY: FormState = {
  name: '',
  role: '',
  domain: '',
  techStack: '',
  contribution: '',
  startDate: '',
  endDate: '',
  employmentId: '',
};

const toInputDate = (value: string | null) =>
  value ? value.slice(0, 10) : '';

/**
 * "Lịch sử dự án tham gia" — role, period, domain, tech stack and the
 * contribution, which is what makes this more than a list of project names.
 */
export default function ProjectsTab({
  projects,
  employments,
  onChanged,
}: {
  projects: ProjectExperience[];
  employments: EmploymentEntry[];
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

  const openEdit = (project: ProjectExperience) => {
    setEditingId(project.id);
    setForm({
      name: project.name,
      role: project.role,
      domain: project.domain ?? '',
      techStack: project.techStack.join(', '),
      contribution: project.contribution ?? '',
      startDate: toInputDate(project.startDate),
      endDate: toInputDate(project.endDate),
      employmentId: project.employmentId ?? '',
    });
    setError(null);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.role.trim() || !form.startDate) {
      setError('Cần có tên dự án, vai trò và ngày bắt đầu.');
      return;
    }

    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      role: form.role.trim(),
      domain: form.domain.trim() || undefined,
      techStack: form.techStack
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      contribution: form.contribution.trim() || undefined,
      startDate: new Date(form.startDate).toISOString(),
      endDate: form.endDate ? new Date(form.endDate).toISOString() : undefined,
      employmentId: form.employmentId || undefined,
    };

    try {
      if (editingId) {
        await updateProjectExperience(editingId, payload);
      } else {
        await createProjectExperience(payload);
      }
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được dự án');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProjectExperience(id);
      onChanged();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Không xóa được dự án',
      );
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={openCreate}>
          Thêm dự án
        </Button>
      </Box>

      {error && !open ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {projects.length === 0 ? (
        <Typography variant="body2">
          Chưa có dự án nào. Thêm thủ công, hoặc nhập CV để điền tự động.
        </Typography>
      ) : (
        <Stack divider={<Divider />} spacing={2}>
          {projects.map((project) => (
            <Box
              key={project.id}
              sx={{
                pt: 1,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                columnGap: 2,
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {project.name}
                </Typography>
                <Typography variant="body2">
                  {project.role}
                  {project.domain ? ` · ${project.domain}` : ''} ·{' '}
                  {toInputDate(project.startDate)} →{' '}
                  {toInputDate(project.endDate) || 'nay'}
                </Typography>
              </Box>

              {project.contribution ? (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {project.contribution}
                </Typography>
              ) : null}

              {project.techStack.length > 0 ? (
                <Stack
                  direction="row"
                  spacing={0.75}
                  sx={{ flexWrap: 'wrap', gap: 0.75, mt: 1 }}
                >
                  {project.techStack.map((tech) => (
                    <Chip key={tech} label={tech} size="small" variant="outlined" />
                  ))}
                </Stack>
              ) : null}

              <Stack
                direction="row"
                spacing={1}
                sx={{
                  mt: { xs: 1.5, sm: 0 },
                  gridColumn: { sm: 2 },
                  gridRow: { sm: 1 },
                }}
              >
                <Button size="sm" onClick={() => openEdit(project)}>
                  Sửa
                </Button>
                <Button
                  size="sm"
                  color="error"
                  onClick={() =>
                    ask({
                      title: 'Xóa dự án',
                      description: `Xóa “${project.name}” khỏi hồ sơ? Hành động này không thể hoàn tác.`,
                      confirmLabel: 'Xóa',
                      danger: true,
                      onConfirm: () => handleDelete(project.id),
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
        title={editingId ? 'Sửa dự án' : 'Thêm dự án'}
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
              label="Tên dự án"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Vai trò của bạn"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Lĩnh vực"
              helperText="Domain nghiệp vụ, ví dụ bất động sản, fintech"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              fullWidth
            />
            <TextField
              label="Công nghệ"
              helperText="Cách nhau bằng dấu phẩy, ví dụ React, Node.js, PostgreSQL"
              value={form.techStack}
              onChange={(e) => setForm({ ...form, techStack: e.target.value })}
              fullWidth
            />
            <TextField
              label="Đóng góp / kết quả"
              value={form.contribution}
              onChange={(e) =>
                setForm({ ...form, contribution: e.target.value })
              }
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Ngày bắt đầu"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                required
                fullWidth
              />
              <TextField
                label="Ngày kết thúc"
                type="date"
                helperText="Để trống nếu đang làm"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Stack>
            {employments.length > 0 ? (
              <TextField
                select
                label="Kỳ làm việc"
                helperText="Gắn dự án với một vị trí để sau này vẫn còn ngữ cảnh"
                value={form.employmentId}
                onChange={(e) =>
                  setForm({ ...form, employmentId: e.target.value })
                }
                fullWidth
              >
                <MenuItem value="">Chưa gắn</MenuItem>
                {employments.map((employment) => (
                  <MenuItem key={employment.id} value={employment.id}>
                    {employment.jobTitle} @ {employment.company.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
          </Stack>
      </Dialog>
      {dialog}
    </Box>
  );
}
