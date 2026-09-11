'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@/components/ui/Button';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { useConfirmDialog } from '@/components/ui/ConfirmDialog';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  createJobRequirement,
  deleteJobRequirement,
  listJobRequirements,
  matchJobRequirement,
  updateJobRequirement,
  type CandidateMatch,
  type JobRequirement,
} from '@/lib/api/jobRequirementsApi';

const STATUS_TONE: Record<string, 'default' | 'success' | 'warning'> = {
  open: 'success',
  closed: 'default',
};

export default function JobRequirementsPage() {
  const { user } = useAuth();
  const { ask, dialog } = useConfirmDialog();

  const [requirements, setRequirements] = React.useState<JobRequirement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [skillsInput, setSkillsInput] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  const [matchingId, setMatchingId] = React.useState<string | null>(null);
  const [matchError, setMatchError] = React.useState<Record<string, string>>({});
  const [matchResults, setMatchResults] = React.useState<
    Record<string, { matches: CandidateMatch[]; summary: string }>
  >({});

  const canManage = user?.role === 'COMPANY_ADMIN' || user?.role === 'SUPER_ADMIN';

  const loadRequirements = React.useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const companyId = user?.role === 'SUPER_ADMIN' ? (user.companyId ?? undefined) : undefined;
      const data = await listJobRequirements(companyId);
      setRequirements(data);
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Failed to load job requirements');
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (user) {
      loadRequirements();
    }
  }, [user, loadRequirements]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const requiredSkills = skillsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!title.trim() || !description.trim() || requiredSkills.length === 0) {
      setFormError('Title, description, and at least one required skill are needed.');
      return;
    }

    setCreating(true);
    try {
      await createJobRequirement({ title: title.trim(), description: description.trim(), requiredSkills });
      setTitle('');
      setDescription('');
      setSkillsInput('');
      await loadRequirements();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to create job requirement');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (requirement: JobRequirement) => {
    const nextStatus = requirement.status === 'open' ? 'closed' : 'open';
    try {
      await updateJobRequirement(requirement.id, { status: nextStatus });
      await loadRequirements();
    } catch {
      // Surfaced via the list reload staying on the old status; no dedicated toast system yet.
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteJobRequirement(id);
      await loadRequirements();
    } catch {
      // Same as above — reload will simply keep showing the row on failure.
    }
  };

  const handleMatch = async (id: string) => {
    setMatchingId(id);
    setMatchError((prev) => ({ ...prev, [id]: '' }));
    try {
      const result = await matchJobRequirement(id);
      setMatchResults((prev) => ({ ...prev, [id]: result }));
    } catch (err) {
      setMatchError((prev) => ({
        ...prev,
        [id]: err instanceof ApiError ? err.message : 'Failed to find matching candidates',
      }));
    } finally {
      setMatchingId(null);
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Job Requirements"
          subtitle="Define what a project needs, then let AI suggest which employees fit."
        />

        {canManage ? (
          <Card title="New requirement" sx={{ mb: 3 }}>
            {formError ? (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            ) : null}
            <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                fullWidth
              />
              <TextField
                label="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                fullWidth
                multiline
                minRows={3}
              />
              <TextField
                label="Required skills"
                helperText="Comma-separated, e.g. React, Node.js, SQL"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                required
                fullWidth
              />
              <Box>
                <Button type="submit" variant="contained" disabled={creating}>
                  {creating ? 'Creating...' : 'Create requirement'}
                </Button>
              </Box>
            </Box>
          </Card>
        ) : null}

        <Card title="Current requirements">
          {listError ? <Alert severity="error">{listError}</Alert> : null}
          {loading ? (
            <PageSkeleton variant="list" rows={4} embedded />
          ) : requirements.length === 0 ? (
            <Typography variant="body2">No job requirements yet.</Typography>
          ) : (
            <Stack divider={<Divider />} spacing={2}>
              {requirements.map((req) => {
                const result = matchResults[req.id];
                const error = matchError[req.id];
                return (
                  <Box key={req.id} sx={{ pt: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        justifyContent: 'space-between',
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: 1,
                      }}
                    >
                      <Box>
                        <Typography variant="h3">{req.title}</Typography>
                        <Typography variant="body2" sx={{ mt: 0.5 }}>
                          {req.description}
                        </Typography>
                      </Box>
                      <Chip
                        label={req.status}
                        color={STATUS_TONE[req.status] ?? 'default'}
                        size="small"
                      />
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
                      {req.requiredSkills.map((skill) => (
                        <Chip key={skill} label={skill} size="small" variant="outlined" />
                      ))}
                    </Stack>

                    <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleMatch(req.id)}
                        disabled={matchingId === req.id}
                      >
                        {matchingId === req.id ? 'Finding matches...' : 'Find matching candidates'}
                      </Button>
                      {canManage ? (
                        <>
                          <Button variant="text" size="small" onClick={() => handleToggleStatus(req)}>
                            {req.status === 'open' ? 'Mark closed' : 'Reopen'}
                          </Button>
                          <Button
                            variant="text"
                            size="sm"
                            color="error"
                            onClick={() =>
                              ask({
                                title: 'Delete requirement',
                                description: `Remove “${req.title}”? This cannot be undone.`,
                                confirmLabel: 'Delete',
                                danger: true,
                                onConfirm: () => handleDelete(req.id),
                              })
                            }
                          >
                            Delete
                          </Button>
                        </>
                      ) : null}
                    </Stack>

                    {matchingId === req.id ? <LinearProgress sx={{ mt: 2 }} /> : null}

                    {error ? (
                      <Alert severity="error" sx={{ mt: 2 }}>
                        {error}
                      </Alert>
                    ) : null}

                    {result ? (
                      <Box sx={{ mt: 2 }}>
                        {result.summary ? (
                          <Typography variant="body2" sx={{ mb: 1.5, fontStyle: 'italic' }}>
                            {result.summary}
                          </Typography>
                        ) : null}
                        {result.matches.length === 0 ? (
                          <Typography variant="body2">No strong candidate matches found.</Typography>
                        ) : (
                          <Stack spacing={1.5}>
                            {result.matches.map((match) => (
                              <Box
                                key={match.userId}
                                sx={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 2,
                                  p: 1.5,
                                  borderRadius: 1,
                                  bgcolor: 'action.hover',
                                }}
                              >
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                    {match.name}
                                    {match.jobTitle ? ` — ${match.jobTitle}` : ''}
                                  </Typography>
                                  <Typography variant="body2">{match.rationale}</Typography>
                                </Box>
                                <Chip
                                  label={`${match.matchScore}%`}
                                  color={match.matchScore >= 70 ? 'success' : match.matchScore >= 40 ? 'warning' : 'default'}
                                />
                              </Box>
                            ))}
                          </Stack>
                        )}
                      </Box>
                    ) : null}
                  </Box>
                );
              })}
            </Stack>
          )}
        </Card>
        {dialog}
      </PageContainer>
    </AppShell>
  );
}
