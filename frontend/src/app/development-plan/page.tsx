'use client';

import * as React from 'react';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import MarkdownSplitEditor from '@/components/ui/MarkdownSplitEditor';
import StatusChip from '@/components/ui/StatusChip';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import CircularProgress from '@mui/material/CircularProgress';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import { colorTokens } from '@/theme/theme';
import { toneForStatus } from '@/lib/statusColors';
import * as developmentPlansApi from '@/lib/api/developmentPlansApi';
import type { DevelopmentGoal, GoalStatus } from '@/lib/api/developmentPlansApi';
import { ApiError } from '@/lib/api/client';

const STATUS_OPTIONS: GoalStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED'];
const STATUS_LABEL: Record<GoalStatus, string> = {
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  ACHIEVED: 'Achieved',
};

/**
 * Goals tracking + AI-assisted roadmap generation, following the same
 * proposal-then-explicit-save skill shape used throughout Workflow Pro
 * (see D:\Coding\AI_Tool\docs\skills.md's intro): "Generate"/"Regenerate"
 * calls the backend AI skill and shows the result as an in-memory draft in
 * MarkdownSplitEditor — nothing is persisted until "Save" is clicked.
 */
export default function DevelopmentPlanPage() {
  const [goals, setGoals] = React.useState<DevelopmentGoal[] | null>(null);
  const [goalsError, setGoalsError] = React.useState<string | null>(null);

  // Add-goal form state
  const [title, setTitle] = React.useState('');
  const [metric, setMetric] = React.useState('');
  const [targetValue, setTargetValue] = React.useState('');
  const [currentValue, setCurrentValue] = React.useState('');
  const [addingGoal, setAddingGoal] = React.useState(false);

  // Plan state
  const [planMd, setPlanMd] = React.useState('');
  const [hasSavedPlan, setHasSavedPlan] = React.useState(false);
  const [planLoading, setPlanLoading] = React.useState(true);
  const [instruction, setInstruction] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [planError, setPlanError] = React.useState<string | null>(null);
  const [lastSummary, setLastSummary] = React.useState<string | null>(null);
  // Tracks whether the current in-editor draft came from the AI skill
  // (vs. a manual edit) so Save can pass the right aiGenerated flag.
  const [draftIsAiGenerated, setDraftIsAiGenerated] = React.useState(false);

  const loadGoals = React.useCallback(() => {
    developmentPlansApi
      .listGoals()
      .then(setGoals)
      .catch((err) => setGoalsError(err instanceof ApiError ? err.message : 'Failed to load goals'));
  }, []);

  React.useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  React.useEffect(() => {
    developmentPlansApi
      .getMyPlan()
      .then((plan) => {
        if (plan) {
          setPlanMd(plan.content);
          setHasSavedPlan(true);
        }
      })
      .catch((err) => setPlanError(err instanceof ApiError ? err.message : 'Failed to load current plan'))
      .finally(() => setPlanLoading(false));
  }, []);

  const handleAddGoal = async () => {
    if (!title.trim()) return;
    setAddingGoal(true);
    setGoalsError(null);
    try {
      await developmentPlansApi.createGoal({
        title: title.trim(),
        metric: metric.trim() || undefined,
        targetValue: targetValue.trim() ? Number(targetValue) : undefined,
        currentValue: currentValue.trim() ? Number(currentValue) : undefined,
      });
      setTitle('');
      setMetric('');
      setTargetValue('');
      setCurrentValue('');
      loadGoals();
    } catch (err) {
      setGoalsError(err instanceof ApiError ? err.message : 'Failed to add goal');
    } finally {
      setAddingGoal(false);
    }
  };

  const handleStatusChange = async (goal: DevelopmentGoal, status: GoalStatus) => {
    setGoalsError(null);
    try {
      const updated = await developmentPlansApi.updateGoal(goal.id, { status });
      setGoals((prev) => prev?.map((g) => (g.id === updated.id ? updated : g)) ?? prev);
    } catch (err) {
      setGoalsError(err instanceof ApiError ? err.message : 'Failed to update goal');
    }
  };

  const handleCurrentValueBlur = async (goal: DevelopmentGoal, value: string) => {
    const trimmed = value.trim();
    const nextValue = trimmed === '' ? undefined : Number(trimmed);
    if (nextValue === goal.currentValue || (nextValue === undefined && goal.currentValue === null)) return;
    if (nextValue === undefined) return;
    setGoalsError(null);
    try {
      const updated = await developmentPlansApi.updateGoal(goal.id, { currentValue: nextValue });
      setGoals((prev) => prev?.map((g) => (g.id === updated.id ? updated : g)) ?? prev);
    } catch (err) {
      setGoalsError(err instanceof ApiError ? err.message : 'Failed to update goal');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    setGoalsError(null);
    try {
      await developmentPlansApi.deleteGoal(id);
      setGoals((prev) => prev?.filter((g) => g.id !== id) ?? prev);
    } catch (err) {
      setGoalsError(err instanceof ApiError ? err.message : 'Failed to delete goal');
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setPlanError(null);
    try {
      const result = await developmentPlansApi.generatePlan({
        instruction: instruction.trim() || undefined,
      });
      setPlanMd(result.planMd);
      setLastSummary(result.summary || null);
      setDraftIsAiGenerated(true);
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Failed to generate development plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    setSaving(true);
    setPlanError(null);
    try {
      await developmentPlansApi.saveMyPlan({
        content: planMd,
        summary: lastSummary || undefined,
        aiGenerated: draftIsAiGenerated,
      });
      setHasSavedPlan(true);
    } catch (err) {
      setPlanError(err instanceof ApiError ? err.message : 'Failed to save development plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <PageContainer>
        <PageHeader title="Development Plan" subtitle="Your personal growth roadmap." />

        <Card title="Goals" sx={{ mb: 3 }}>
          {goalsError ? (
            <Typography variant="body2" sx={{ color: colorTokens.danger, mb: 2 }}>
              {goalsError}
            </Typography>
          ) : null}

          {!goals ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : goals.length === 0 ? (
            <Typography variant="body2" sx={{ color: colorTokens.neutral400, mb: 2 }}>
              No goals yet — add your first one below.
            </Typography>
          ) : (
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              {goals.map((goal) => (
                <Box
                  key={goal.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    p: 1.5,
                    border: `1px solid ${colorTokens.divider}`,
                    borderRadius: 2,
                    flexWrap: 'wrap',
                  }}
                >
                  <Box sx={{ flex: '1 1 200px' }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {goal.title}
                    </Typography>
                    {goal.metric ? (
                      <Typography variant="body2" sx={{ color: colorTokens.neutral400 }}>
                        {goal.metric}
                      </Typography>
                    ) : null}
                  </Box>

                  <TextField
                    label="Current"
                    type="number"
                    size="small"
                    defaultValue={goal.currentValue ?? ''}
                    onBlur={(e) => handleCurrentValueBlur(goal, e.target.value)}
                    sx={{ width: 100 }}
                  />
                  <Typography variant="body2" sx={{ color: colorTokens.neutral400 }}>
                    / {goal.targetValue ?? '—'}
                  </Typography>

                  <TextField
                    select
                    size="small"
                    value={goal.status}
                    onChange={(e) => handleStatusChange(goal, e.target.value as GoalStatus)}
                    sx={{ width: 150 }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <MenuItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </MenuItem>
                    ))}
                  </TextField>

                  <StatusChip label={STATUS_LABEL[goal.status]} tone={toneForStatus(goal.status)} />

                  <IconButton size="small" onClick={() => handleDeleteGoal(goal.id)} aria-label="Delete goal">
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Stack>
          )}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
            <TextField
              label="Goal title"
              size="small"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
            />
            <TextField
              label="Metric (optional)"
              size="small"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              fullWidth
            />
            <TextField
              label="Target value (optional)"
              type="number"
              size="small"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              sx={{ width: { xs: '100%', md: 160 } }}
            />
            <TextField
              label="Current value (optional)"
              type="number"
              size="small"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              sx={{ width: { xs: '100%', md: 160 } }}
            />
            <Button variant="contained" onClick={handleAddGoal} disabled={addingGoal || !title.trim()}>
              Add goal
            </Button>
          </Stack>
        </Card>

        <Card title="Development Plan">
          <TextField
            label="Instruction (optional)"
            placeholder="e.g. Focus more on leadership skills for the next quarter"
            size="small"
            fullWidth
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
            <Button variant="contained" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating…' : hasSavedPlan ? 'Regenerate' : 'Generate'}
            </Button>
            <Button variant="outlined" onClick={handleSavePlan} disabled={saving || !planMd.trim()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Stack>

          {planError ? (
            <Typography variant="body2" sx={{ color: colorTokens.danger, mb: 2 }}>
              {planError}
            </Typography>
          ) : null}

          {lastSummary ? (
            <Typography variant="body2" sx={{ color: colorTokens.neutral400, mb: 2 }}>
              {lastSummary}
            </Typography>
          ) : null}

          {planLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <MarkdownSplitEditor
              value={planMd}
              onChange={(value) => {
                setPlanMd(value);
                setDraftIsAiGenerated(false);
              }}
              height={480}
            />
          )}
        </Card>
      </PageContainer>
    </AppShell>
  );
}
