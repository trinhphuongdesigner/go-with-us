'use client';

import * as React from 'react';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import MarkdownSplitEditor from '@/components/ui/MarkdownSplitEditor';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Button from '@/components/ui/Button';
import PageSkeleton from '@/components/ui/PageSkeleton';
import { colorTokens } from '@/theme/theme';
import * as developmentPlansApi from '@/lib/api/developmentPlansApi';
import type {
  DevelopmentGoal,
  DevelopmentMilestone,
} from '@/lib/api/developmentPlansApi';
import { ApiError } from '@/lib/api/client';
import GoalsPanel from './GoalsPanel';
import MilestonesPanel from './MilestonesPanel';
import RoadmapAssistant from './RoadmapAssistant';

/**
 * Goals (Work/Personal), the measurable milestone/task roadmap, the
 * AI roadmap-building assistant, and the free-form markdown plan — same
 * proposal-then-explicit-save shape used throughout Workflow Pro (see
 * D:\Coding\AI_Tool\docs\skills.md's intro) for both the markdown plan and
 * the roadmap assistant's milestone proposals.
 */
export default function DevelopmentPlanPage() {
  const [goals, setGoals] = React.useState<DevelopmentGoal[] | null>(null);
  const [goalsError, setGoalsError] = React.useState<string | null>(null);

  const [milestones, setMilestones] = React.useState<DevelopmentMilestone[] | null>(
    null,
  );
  const [milestonesError, setMilestonesError] = React.useState<string | null>(
    null,
  );

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
      .catch((err) => setGoalsError(err instanceof ApiError ? err.message : 'Không tải được mục tiêu'));
  }, []);

  const loadMilestones = React.useCallback(() => {
    developmentPlansApi
      .listMilestones()
      .then(setMilestones)
      .catch((err) =>
        setMilestonesError(
          err instanceof ApiError ? err.message : 'Không tải được lộ trình',
        ),
      );
  }, []);

  React.useEffect(() => {
    loadGoals();
    loadMilestones();
  }, [loadGoals, loadMilestones]);

  React.useEffect(() => {
    developmentPlansApi
      .getMyPlan()
      .then((plan) => {
        if (plan) {
          setPlanMd(plan.content);
          setHasSavedPlan(true);
        }
      })
      .catch((err) => setPlanError(err instanceof ApiError ? err.message : 'Không tải được kế hoạch hiện tại'))
      .finally(() => setPlanLoading(false));
  }, []);

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
      setPlanError(err instanceof ApiError ? err.message : 'Không tạo được kế hoạch phát triển');
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
      setPlanError(err instanceof ApiError ? err.message : 'Không lưu được kế hoạch phát triển');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer>
        <PageHeader title="Lộ trình phát triển" subtitle="Lộ trình phát triển cá nhân của bạn." />

        <Card title="Mục tiêu" sx={{ mb: 3 }}>
          {goalsError ? (
            <Typography variant="body2" sx={{ color: colorTokens.danger, mb: 2 }}>
              {goalsError}
            </Typography>
          ) : null}
          {!goals ? (
            <PageSkeleton variant="list" rows={3} embedded />
          ) : (
            <GoalsPanel goals={goals} onChanged={loadGoals} />
          )}
        </Card>

        <Card title="Cột mốc lộ trình" sx={{ mb: 3 }}>
          {milestonesError ? (
            <Typography variant="body2" sx={{ color: colorTokens.danger, mb: 2 }}>
              {milestonesError}
            </Typography>
          ) : null}
          {!milestones ? (
            <PageSkeleton variant="list" rows={3} embedded />
          ) : (
            <MilestonesPanel milestones={milestones} onChanged={loadMilestones} />
          )}
        </Card>

        <Card title="Dựng lộ trình bằng AI" sx={{ mb: 3 }}>
          <RoadmapAssistant onSaved={loadMilestones} />
        </Card>

        <Card title="Kế hoạch phát triển">
          <TextField
            label="Hướng dẫn (tuỳ chọn)"
            placeholder="ví dụ Tập trung kỹ năng lãnh đạo trong quý tới"
            size="small"
            fullWidth
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            sx={{ mb: 2 }}
          />

          <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
            <Button variant="contained" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Đang tạo…' : hasSavedPlan ? 'Tạo lại' : 'Tạo'}
            </Button>
            <Button variant="outlined" onClick={handleSavePlan} disabled={saving || !planMd.trim()}>
              {saving ? 'Đang lưu…' : 'Lưu'}
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
            <PageSkeleton variant="form" embedded />
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
  );
}
