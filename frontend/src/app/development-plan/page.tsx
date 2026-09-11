'use client';

import * as React from 'react';
import AppShell from '@/components/layout/AppShell';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import MarkdownSplitEditor from '@/components/ui/MarkdownSplitEditor';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '@/contexts/AuthContext';
import * as developmentPlansApi from '@/lib/api/developmentPlansApi';
import type { DevelopmentGoal, DevelopmentMilestone } from '@/lib/api/developmentPlansApi';
import GoalsPanel from './GoalsPanel';
import MilestonesPanel from './MilestonesPanel';
import RoadmapAssistant from './RoadmapAssistant';
import RoadmapJourney from './RoadmapJourney';

function DevelopmentPlanContent() {
  const [goals, setGoals] = React.useState<DevelopmentGoal[] | null>(null);
  const [goalsError, setGoalsError] = React.useState<string | null>(null);
  const [milestones, setMilestones] = React.useState<DevelopmentMilestone[] | null>(null);
  const [milestonesError, setMilestonesError] = React.useState<string | null>(null);
  const [planMd, setPlanMd] = React.useState('');
  const [savedPlanMd, setSavedPlanMd] = React.useState('');
  const [planLoading, setPlanLoading] = React.useState(true);
  const [instruction, setInstruction] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [planError, setPlanError] = React.useState<string | null>(null);
  const [planSaved, setPlanSaved] = React.useState(false);
  const [lastSummary, setLastSummary] = React.useState<string | null>(null);
  const [draftIsAiGenerated, setDraftIsAiGenerated] = React.useState(false);
  const planPending = React.useRef(false);

  const loadGoals = React.useCallback(
    () =>
      developmentPlansApi
        .listGoals()
        .then((data) => {
          setGoals(data);
          setGoalsError(null);
        })
        .catch((err) => {
          setGoalsError(err instanceof Error ? err.message : 'Failed to load goals');
        }),
    [],
  );

  const loadMilestones = React.useCallback(
    () =>
      developmentPlansApi
        .listMilestones()
        .then((data) => {
          setMilestones(data);
          setMilestonesError(null);
        })
        .catch((err) => {
          const message = err instanceof Error ? err.message : 'Failed to load roadmap';
          setMilestonesError(message);
          throw new Error(message);
        }),
    [],
  );

  React.useEffect(() => {
    void loadGoals();
    void loadMilestones().catch(() => undefined);
  }, [loadGoals, loadMilestones]);

  React.useEffect(() => {
    developmentPlansApi
      .getMyPlan()
      .then((plan) => {
        setPlanMd(plan?.content ?? '');
        setSavedPlanMd(plan?.content ?? '');
      })
      .catch((err) =>
        setPlanError(err instanceof Error ? err.message : 'Failed to load current plan'),
      )
      .finally(() => setPlanLoading(false));
  }, []);

  const handleGenerate = async () => {
    if (planPending.current || planLoading) return;
    planPending.current = true;
    setGenerating(true);
    setPlanError(null);
    setPlanSaved(false);
    try {
      const result = await developmentPlansApi.generatePlan({
        instruction: instruction.trim() || undefined,
      });
      setPlanMd(result.planMd);
      setLastSummary(result.summary || null);
      setDraftIsAiGenerated(true);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to generate development plan');
    } finally {
      planPending.current = false;
      setGenerating(false);
    }
  };

  const handleSavePlan = async () => {
    if (planPending.current || planLoading || !planMd.trim()) return;
    planPending.current = true;
    setSaving(true);
    setPlanError(null);
    setPlanSaved(false);
    try {
      const plan = await developmentPlansApi.saveMyPlan({
        content: planMd,
        summary: lastSummary || undefined,
        aiGenerated: draftIsAiGenerated,
      });
      setSavedPlanMd(plan.content);
      setPlanSaved(true);
    } catch (err) {
      setPlanError(err instanceof Error ? err.message : 'Failed to save development plan');
    } finally {
      planPending.current = false;
      setSaving(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Development Plan"
        subtitle="Turn your next career step into milestones you can measure."
      />
      <Card title="Your growth roadmap" sx={{ mb: 3, minWidth: 0 }}>
        {milestones ? <RoadmapJourney milestones={milestones} goals={goals ?? []} /> : null}
        {milestonesError ? (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                onClick={() => {
                  void loadMilestones().catch(() => undefined);
                }}
              >
                Retry
              </Button>
            }
          >
            {milestonesError}
          </Alert>
        ) : null}
        {milestones ? (
          <MilestonesPanel milestones={milestones} onChanged={loadMilestones} />
        ) : !milestonesError ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading roadmap" size={24} />
          </Box>
        ) : null}
      </Card>
      <Card title="Build your next steps with AI" sx={{ mb: 3, minWidth: 0 }}>
        <RoadmapAssistant
          existingMilestones={milestonesError ? null : milestones}
          onSaved={(saved) => {
            setMilestones(saved);
            setMilestonesError(null);
          }}
        />
      </Card>
      <Card title="Goals" sx={{ mb: 3 }}>
        {goalsError ? (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button
                color="inherit"
                onClick={() => {
                  void loadGoals();
                }}
              >
                Retry
              </Button>
            }
          >
            {goalsError}
          </Alert>
        ) : null}
        {goals ? (
          <GoalsPanel goals={goals} onChanged={loadGoals} />
        ) : !goalsError ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress aria-label="Loading goals" size={24} />
          </Box>
        ) : null}
      </Card>
      <Card>
        <Box component="details">
          <Typography component="summary" variant="h2" sx={{ cursor: 'pointer', py: 0.5 }}>
            Plan notes
          </Typography>
          <Typography variant="body2" sx={{ my: 2 }}>
            Keep a longer narrative alongside your roadmap. Review generated notes in the preview
            before saving.
          </Typography>
          <TextField
            label="Instruction (optional)"
            placeholder="e.g. Focus more on leadership skills for the next quarter"
            size="small"
            fullWidth
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={planLoading || generating || saving}
            sx={{ mb: 2 }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              onClick={() => void handleGenerate()}
              disabled={planLoading || generating || saving || planMd !== savedPlanMd}
            >
              {generating ? 'Generating…' : 'Suggest plan notes'}
            </Button>
            <Button
              variant="contained"
              onClick={() => void handleSavePlan()}
              disabled={
                planLoading || saving || generating || !planMd.trim() || planMd === savedPlanMd
              }
            >
              {saving ? 'Saving…' : 'Save reviewed notes'}
            </Button>
          </Stack>
          {planError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {planError}
            </Alert>
          ) : null}
          {planSaved ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Plan notes saved.
            </Alert>
          ) : null}
          {lastSummary ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {lastSummary}
            </Alert>
          ) : null}
          {planLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <Box
              component="fieldset"
              disabled={saving || generating}
              sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
            >
              <MarkdownSplitEditor
                value={planMd}
                onChange={(value) => {
                  setPlanMd(value);
                  setDraftIsAiGenerated(false);
                  setLastSummary(null);
                  setPlanSaved(false);
                }}
                height={420}
              />
            </Box>
          )}
        </Box>
      </Card>
    </PageContainer>
  );
}

export default function DevelopmentPlanPage() {
  const { user } = useAuth();
  return <AppShell>{user ? <DevelopmentPlanContent key={user.id} /> : null}</AppShell>;
}
