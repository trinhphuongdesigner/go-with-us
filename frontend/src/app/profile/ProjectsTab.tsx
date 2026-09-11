'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
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
      setError('Project name, your role and a start date are required.');
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
      setError(err instanceof ApiError ? err.message : 'Failed to save project');
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
        err instanceof ApiError ? err.message : 'Failed to delete project',
      );
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button startIcon={<AddIcon />} variant="outlined" onClick={openCreate}>
          Add project
        </Button>
      </Box>

      {error && !open ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {projects.length === 0 ? (
        <Typography variant="body2">
          No projects recorded yet. Add one, or import your CV to fill this in
          automatically.
        </Typography>
      ) : (
        <Stack divider={<Divider />} spacing={2}>
          {projects.map((project) => (
            <Box key={project.id} sx={{ pt: 1 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 2,
                  flexDirection: { xs: 'column', sm: 'row' },
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
                    {toInputDate(project.endDate) || 'now'}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" onClick={() => openEdit(project)}>
                    Edit
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => handleDelete(project.id)}
                  >
                    Delete
                  </Button>
                </Stack>
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
            </Box>
          ))}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? 'Edit project' : 'Add project'}</DialogTitle>
        <DialogContent>
          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Project name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Your role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Domain"
              helperText="Business domain, e.g. real estate, fintech"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              fullWidth
            />
            <TextField
              label="Tech stack"
              helperText="Comma-separated, e.g. React, Node.js, PostgreSQL"
              value={form.techStack}
              onChange={(e) => setForm({ ...form, techStack: e.target.value })}
              fullWidth
            />
            <TextField
              label="Contribution / result"
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
                label="Start date"
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                required
                fullWidth
              />
              <TextField
                label="End date"
                type="date"
                helperText="Leave empty if ongoing"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            </Stack>
            {employments.length > 0 ? (
              <TextField
                select
                label="Employment period"
                helperText="Links this project to a job, so it stays in context later"
                value={form.employmentId}
                onChange={(e) =>
                  setForm({ ...form, employmentId: e.target.value })
                }
                fullWidth
              >
                <MenuItem value="">Not linked</MenuItem>
                {employments.map((employment) => (
                  <MenuItem key={employment.id} value={employment.id}>
                    {employment.jobTitle} @ {employment.company.name}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
