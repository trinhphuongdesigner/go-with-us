'use client';

import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api/client';
import {
  createCycle,
  createTemplate,
  deleteTemplate,
  listCycles,
  listTemplates,
  updateCycle,
  updateTemplate,
  type AssessmentCycle,
  type AssessmentTemplate,
  type GroupPayload,
} from '@/lib/api/assessmentsApi';
import { colorTokens } from '@/theme/theme';

interface DraftQuestion {
  text: string;
  guidance: string;
  weight: number;
  maxScore: number;
}

interface DraftGroup {
  name: string;
  description: string;
  weight: number;
  questions: DraftQuestion[];
}

const emptyQuestion = (): DraftQuestion => ({
  text: '',
  guidance: '',
  weight: 1,
  maxScore: 10,
});

const emptyGroup = (): DraftGroup => ({
  name: '',
  description: '',
  weight: 1,
  questions: [emptyQuestion()],
});

const toDraft = (template: AssessmentTemplate): DraftGroup[] =>
  template.groups.map((group) => ({
    name: group.name,
    description: group.description ?? '',
    weight: group.weight,
    questions: group.questions.map((question) => ({
      text: question.text,
      guidance: question.guidance ?? '',
      weight: question.weight,
      maxScore: question.maxScore,
    })),
  }));

const currentPeriod = () => new Date().toISOString().slice(0, 7);

/**
 * M3 config — each company builds its own competency scale here: criteria
 * groups with weights, questions with an "expand" description, scored 1-10.
 * Editing a live template bumps its version; assessments already approved
 * keep the frozen copy they were approved against.
 */
export default function AssessmentTemplatesPage() {
  const { user } = useAuth();

  const [templates, setTemplates] = React.useState<AssessmentTemplate[]>([]);
  const [cycles, setCycles] = React.useState<AssessmentCycle[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [groups, setGroups] = React.useState<DraftGroup[]>([emptyGroup()]);

  const [cycleName, setCycleName] = React.useState('');
  const [cyclePeriod, setCyclePeriod] = React.useState(currentPeriod());
  const [cycleTemplateId, setCycleTemplateId] = React.useState('');

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateList, cycleList] = await Promise.all([
        listTemplates(),
        listCycles(),
      ]);
      setTemplates(templateList);
      setCycles(cycleList);
      if (!cycleTemplateId && templateList.length > 0) {
        setCycleTemplateId(templateList[0].id);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
    // cycleTemplateId is only seeded once; re-running on its change would
    // re-fetch on every select.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!user) return;
    // Wrapped so the initial fetch's setState lands after the effect.
    void (async () => {
      await load();
    })();
  }, [user, load]);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setGroups([emptyGroup()]);
  };

  const startEdit = (template: AssessmentTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setDescription(template.description ?? '');
    setGroups(toDraft(template));
    setNotice(null);
    setError(null);
  };

  const patchGroup = (index: number, patch: Partial<DraftGroup>) => {
    setGroups(groups.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  };

  const patchQuestion = (
    groupIndex: number,
    questionIndex: number,
    patch: Partial<DraftQuestion>,
  ) => {
    setGroups(
      groups.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              questions: group.questions.map((question, qi) =>
                qi === questionIndex ? { ...question, ...patch } : question,
              ),
            }
          : group,
      ),
    );
  };

  const handleSave = async () => {
    const cleanGroups: GroupPayload[] = groups
      .filter((group) => group.name.trim())
      .map((group) => ({
        name: group.name.trim(),
        description: group.description.trim() || undefined,
        weight: group.weight,
        questions: group.questions
          .filter((question) => question.text.trim())
          .map((question) => ({
            text: question.text.trim(),
            guidance: question.guidance.trim() || undefined,
            weight: question.weight,
            maxScore: question.maxScore,
          })),
      }))
      .filter((group) => group.questions.length > 0);

    if (!name.trim() || cleanGroups.length === 0) {
      setError('A name and at least one group with one question are required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await updateTemplate(editingId, {
          name: name.trim(),
          description: description.trim() || undefined,
          groups: cleanGroups,
        });
        setNotice('Template updated — approved assessments keep their old scale.');
      } else {
        await createTemplate({
          name: name.trim(),
          description: description.trim() || undefined,
          groups: cleanGroups,
        });
        setNotice('Template created.');
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (template: AssessmentTemplate) => {
    try {
      await updateTemplate(template.id, {
        status: template.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE',
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update status');
    }
  };

  const handleDelete = async (template: AssessmentTemplate) => {
    try {
      const result = await deleteTemplate(template.id);
      setNotice(
        result.archived
          ? 'This template is in use, so it was archived instead of deleted.'
          : 'Template deleted.',
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete');
    }
  };

  const handleCreateCycle = async () => {
    if (!cycleName.trim() || !cycleTemplateId) {
      setError('A cycle name and template are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createCycle({
        name: cycleName.trim(),
        templateId: cycleTemplateId,
        period: cyclePeriod,
      });
      setCycleName('');
      setNotice('Cycle opened — people can start their check-in now.');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to open cycle');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleCycle = async (cycle: AssessmentCycle) => {
    try {
      await updateCycle(cycle.id, {
        status: cycle.status === 'OPEN' ? 'CLOSED' : 'OPEN',
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update cycle');
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <PageHeader
          title="Assessment criteria"
          subtitle="Build your company's own competency scale — criteria groups, weights, and questions scored 1-10."
        />

        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : null}
        {notice ? (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setNotice(null)}>
            {notice}
          </Alert>
        ) : null}
        {loading ? <LinearProgress sx={{ mb: 3 }} /> : null}

        <Card
          title={editingId ? 'Edit scale' : 'New scale'}
          sx={{ mb: 3 }}
          actions={
            editingId ? (
              <Button size="small" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : undefined
          }
        >
          <Stack spacing={2}>
            <TextField
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
            />

            {groups.map((group, groupIndex) => (
              <Box
                key={groupIndex}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${colorTokens.divider}`,
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{ mb: 1.5 }}
                >
                  <TextField
                    label={`Criteria group ${groupIndex + 1}`}
                    value={group.name}
                    onChange={(e) =>
                      patchGroup(groupIndex, { name: e.target.value })
                    }
                    size="small"
                    fullWidth
                  />
                  <TextField
                    label="Weight"
                    type="number"
                    value={group.weight}
                    onChange={(e) =>
                      patchGroup(groupIndex, {
                        weight: Number(e.target.value) || 0,
                      })
                    }
                    size="small"
                    sx={{ width: 120 }}
                  />
                  <IconButton
                    onClick={() =>
                      setGroups(groups.filter((_, i) => i !== groupIndex))
                    }
                    disabled={groups.length === 1}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>

                <TextField
                  label="Group description"
                  value={group.description}
                  onChange={(e) =>
                    patchGroup(groupIndex, { description: e.target.value })
                  }
                  size="small"
                  fullWidth
                  sx={{ mb: 2 }}
                />

                <Stack spacing={1.5}>
                  {group.questions.map((question, questionIndex) => (
                    <Box
                      key={questionIndex}
                      sx={{
                        pl: 2,
                        borderLeft: `2px solid ${colorTokens.accent900}`,
                      }}
                    >
                      <Stack direction="row" spacing={1.5} sx={{ mb: 1 }}>
                        <TextField
                          label={`Question ${questionIndex + 1}`}
                          value={question.text}
                          onChange={(e) =>
                            patchQuestion(groupIndex, questionIndex, {
                              text: e.target.value,
                            })
                          }
                          size="small"
                          fullWidth
                        />
                        <TextField
                          label="Weight"
                          type="number"
                          value={question.weight}
                          onChange={(e) =>
                            patchQuestion(groupIndex, questionIndex, {
                              weight: Number(e.target.value) || 0,
                            })
                          }
                          size="small"
                          sx={{ width: 110 }}
                        />
                        <TextField
                          label="Max"
                          type="number"
                          value={question.maxScore}
                          onChange={(e) =>
                            patchQuestion(groupIndex, questionIndex, {
                              maxScore: Number(e.target.value) || 10,
                            })
                          }
                          size="small"
                          sx={{ width: 90 }}
                        />
                        <IconButton
                          onClick={() =>
                            patchGroup(groupIndex, {
                              questions: group.questions.filter(
                                (_, i) => i !== questionIndex,
                              ),
                            })
                          }
                          disabled={group.questions.length === 1}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                      <TextField
                        label="Guidance"
                        helperText="What this criterion means / how to score it"
                        value={question.guidance}
                        onChange={(e) =>
                          patchQuestion(groupIndex, questionIndex, {
                            guidance: e.target.value,
                          })
                        }
                        size="small"
                        fullWidth
                      />
                    </Box>
                  ))}
                </Stack>

                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  sx={{ mt: 1.5 }}
                  onClick={() =>
                    patchGroup(groupIndex, {
                      questions: [...group.questions, emptyQuestion()],
                    })
                  }
                >
                  Add question
                </Button>
              </Box>
            ))}

            <Box>
              <Button
                startIcon={<AddIcon />}
                variant="outlined"
                onClick={() => setGroups([...groups, emptyGroup()])}
              >
                Add criteria group
              </Button>
            </Box>

            <Box>
              <Button variant="contained" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingId ? 'Update scale' : 'Create scale'}
              </Button>
            </Box>
          </Stack>
        </Card>

        <Card title="Existing scales" sx={{ mb: 3 }}>
          {templates.length === 0 ? (
            <Typography variant="body2">No scale defined yet.</Typography>
          ) : (
            <Stack divider={<Divider />} spacing={2}>
              {templates.map((template) => (
                <Box key={template.id} sx={{ pt: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 2,
                      flexDirection: { xs: 'column', sm: 'row' },
                    }}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {template.name}
                        </Typography>
                        <Chip
                          label={template.status}
                          size="small"
                          color={template.status === 'ACTIVE' ? 'success' : 'default'}
                        />
                        <Chip label={`v${template.version}`} size="small" variant="outlined" />
                      </Stack>
                      <Typography variant="body2">
                        {template.groups.length} groups ·{' '}
                        {template.groups.reduce(
                          (sum, group) => sum + group.questions.length,
                          0,
                        )}{' '}
                        questions
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" onClick={() => startEdit(template)}>
                        Edit
                      </Button>
                      <Button size="small" onClick={() => handleActivate(template)}>
                        {template.status === 'ACTIVE' ? 'Set draft' : 'Activate'}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleDelete(template)}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </Card>

        <Card title="Assessment cycles">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ mb: 2.5 }}
          >
            <TextField
              label="Cycle name"
              placeholder="September check-in"
              value={cycleName}
              onChange={(e) => setCycleName(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Period"
              type="month"
              value={cyclePeriod}
              onChange={(e) => setCyclePeriod(e.target.value)}
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              sx={{ minWidth: 160 }}
            />
            <TextField
              select
              label="Scale"
              value={cycleTemplateId}
              onChange={(e) => setCycleTemplateId(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            >
              {templates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </TextField>
            <Box>
              <Button
                variant="contained"
                onClick={handleCreateCycle}
                disabled={saving || templates.length === 0}
              >
                Open cycle
              </Button>
            </Box>
          </Stack>

          {cycles.length === 0 ? (
            <Typography variant="body2">No cycle opened yet.</Typography>
          ) : (
            <Stack divider={<Divider />} spacing={1.5}>
              {cycles.map((cycle) => (
                <Box
                  key={cycle.id}
                  sx={{
                    pt: 1,
                    display: 'flex',
                    alignItems: { sm: 'center' },
                    justifyContent: 'space-between',
                    flexDirection: { xs: 'column', sm: 'row' },
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {cycle.name} · {cycle.period}
                    </Typography>
                    <Typography variant="body2">
                      {cycle.template?.name ?? 'Unknown scale'} ·{' '}
                      {cycle._count?.assessments ?? 0} assessments
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Chip
                      label={cycle.status}
                      size="small"
                      color={cycle.status === 'OPEN' ? 'success' : 'default'}
                    />
                    <Button size="small" onClick={() => handleToggleCycle(cycle)}>
                      {cycle.status === 'OPEN' ? 'Close' : 'Reopen'}
                    </Button>
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
