'use client';

import * as React from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import * as developmentPlansApi from '@/lib/api/developmentPlansApi';
import type {
  DevelopmentMilestone,
  DevelopmentPlan,
  DevelopmentRoadmap,
  LifeCategory,
  RoadmapDisplaySettings,
} from '@/lib/api/developmentPlansApi';
import { askAssistant } from '@/lib/api/assistantApi';
import { colorTokens } from '@/theme/theme';
import RoadmapSection from './RoadmapSection';
import RoadmapCustomizePanel, { type CustomizeSaveData } from './RoadmapCustomizePanel';
import type { RoadmapCharacter } from './roadmapCharacters';

type ViewMode = 'stair' | 'diagram';

/** Draft roadmap shape shared with RoadmapSection before it's actually saved. */
function makeDraftRoadmap(category: LifeCategory, milestones: DevelopmentMilestone[]): DevelopmentRoadmap {
  return {
    id: 'draft',
    planId: '',
    category,
    durationWeeks: null,
    hoursPerWeek: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    milestones,
  };
}

export default function DevelopmentPlanTab() {
  const [plan, setPlan] = React.useState<DevelopmentPlan | null>(null);
  const [category, setCategory] = React.useState<LifeCategory>('WORK');
  const [roadmaps, setRoadmaps] = React.useState<DevelopmentRoadmap[] | null>(null);
  const [roadmapsError, setRoadmapsError] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<ViewMode>('stair');
  const [customizing, setCustomizing] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);

  // AI roadmap builder state — the proposal is never self-persisting.
  const [aiInput, setAiInput] = React.useState('');
  const [aiBusy, setAiBusy] = React.useState(false);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [aiProposal, setAiProposal] = React.useState<DevelopmentMilestone[] | null>(null);

  const loadPlan = React.useCallback(
    () =>
      developmentPlansApi.getMyPlan().then((data) => {
        setPlan(data);
        if (data?.displaySettings?.viewMode) setViewMode(data.displaySettings.viewMode);
      }),
    [],
  );

  const loadRoadmaps = React.useCallback(
    (cat: LifeCategory) =>
      developmentPlansApi
        .listRoadmaps(cat)
        .then((data) => {
          setRoadmaps(data);
          setRoadmapsError(null);
        })
        .catch((err) => {
          setRoadmapsError(err instanceof Error ? err.message : 'Không tải được lộ trình');
        }),
    [],
  );

  React.useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  React.useEffect(() => {
    void loadRoadmaps(category);
    setAiProposal(null);
    setCustomizing(false);
  }, [category, loadRoadmaps]);

  const isDraft = aiProposal !== null;
  const character = plan?.displaySettings?.character as RoadmapCharacter | 'none' | undefined;
  const draftRoadmap = React.useMemo(
    () => (isDraft ? makeDraftRoadmap(category, aiProposal!) : null),
    [aiProposal, category, isDraft],
  );

  // Prefill for "Tùy chỉnh lộ trình": the AI draft if there is one, else the newest saved roadmap.
  const customizeSource = draftRoadmap ?? roadmaps?.[0] ?? null;

  // ---- Task edits: persisted milestones hit the API, draft edits stay local ----

  const handleToggleTask = (roadmapId: string, taskId: string, done: boolean) => {
    if (roadmapId === 'draft') {
      setAiProposal((prev) =>
        prev ? prev.map((m) => ({ ...m, tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)) })) : null,
      );
      return;
    }
    setRoadmaps((prev) =>
      prev
        ? prev.map((r) =>
            r.id !== roadmapId
              ? r
              : {
                  ...r,
                  milestones: r.milestones.map((m) => ({
                    ...m,
                    tasks: m.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)),
                  })),
                },
          )
        : null,
    );
    void developmentPlansApi.updateTask(taskId, { done }).catch(() => void loadRoadmaps(category));
  };

  // ---- AI roadmap skill: proposal only, explicit save persists ----

  const handleAskAI = async () => {
    const q = aiInput.trim();
    if (!q || aiBusy) return;

    setAiBusy(true);
    setAiError(null);

    const categoryLabel = category === 'WORK' ? 'Công việc' : 'Cá nhân';
    const pace = customizeSource;
    const paceNote =
      pace?.durationWeeks || pace?.hoursPerWeek
        ? ` Thời lượng mong muốn: ${pace?.durationWeeks ? `${pace.durationWeeks} tuần` : ''}${
            pace?.durationWeeks && pace?.hoursPerWeek ? ', ' : ''
          }${pace?.hoursPerWeek ? `${pace.hoursPerWeek} giờ mỗi tuần` : ''}.`
        : '';
    const enrichedQuestion = `${q}\n\nLoại mục tiêu: ${categoryLabel}.${paceNote} Hãy xây dựng lộ trình với các cột mốc và nhiệm vụ phù hợp.`;

    try {
      const res = await askAssistant({ question: enrichedQuestion, focus: 'ROADMAP' });
      if (res.message.proposalData) {
        const temp: DevelopmentMilestone[] = res.message.proposalData.milestones.map((m, i) => ({
          id: `temp-${i}`,
          roadmapId: 'draft',
          title: m.title,
          description: m.description ?? null,
          dueDate: m.dueDate ?? null,
          status: 'NOT_STARTED',
          order: i,
          tasks: m.tasks.map((t, ti) => ({
            id: `temp-${i}-${ti}`,
            milestoneId: `temp-${i}`,
            title: t.title,
            metric: t.metric ?? null,
            done: false,
            order: ti,
          })),
        }));
        setAiProposal(temp);
      } else {
        setAiError(res.message.content || 'AI cần thêm thông tin để đưa ra đề xuất.');
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Không tạo được đề xuất');
    } finally {
      setAiBusy(false);
    }
  };

  const handleSaveAiProposal = async () => {
    if (!aiProposal) return;
    try {
      const saved = await developmentPlansApi.saveRoadmap({
        category,
        milestones: aiProposal.map((m) => ({
          title: m.title,
          description: m.description ?? undefined,
          dueDate: m.dueDate ?? undefined,
          tasks: m.tasks.map((t) => ({ title: t.title, metric: t.metric ?? undefined })),
        })),
      });
      setRoadmaps((prev) => [saved, ...(prev ?? [])]);
      setAiProposal(null);
      setAiInput('');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Lưu lộ trình thất bại');
    }
  };

  // ---- Tùy chỉnh lộ trình: inline editor replaces the main card body ----

  const handleSaveCustomize = async (data: CustomizeSaveData) => {
    setSavingSettings(true);
    try {
      const saved = await developmentPlansApi.saveRoadmap({
        category: data.category,
        durationWeeks: data.durationWeeks,
        hoursPerWeek: data.hoursPerWeek,
        milestones: data.milestones.map((d) => ({
          title: d.title,
          description: d.description || undefined,
          dueDate: d.dueDate || undefined,
          tasks: d.tasks.map((t) => ({ title: t.title, metric: t.metric || undefined })),
        })),
      });
      const updatedPlan = await developmentPlansApi.updatePlanSettings(data.settings);
      setPlan(updatedPlan);
      if (data.settings.viewMode) setViewMode(data.settings.viewMode);
      setCategory(data.category);
      setRoadmaps((prev) => [saved, ...(prev ?? [])]);
      setAiProposal(null);
      setCustomizing(false);
    } catch (e) {
      setRoadmapsError(e instanceof Error ? e.message : 'Lưu tùy chỉnh thất bại');
    } finally {
      setSavingSettings(false);
    }
  };

  const defaultSettings: RoadmapDisplaySettings = {
    character: plan?.displaySettings?.character ?? 'milo-standing',
    viewMode: plan?.displaySettings?.viewMode ?? 'stair',
  };

  const savedRoadmaps = roadmaps ?? [];
  const hasAnyRoadmap = isDraft || savedRoadmaps.length > 0;

  return (
    <Box>
      <Card sx={{ mb: 3, minWidth: 0 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' }, mb: 2 }}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 600, fontSize: 16 }}>Hành trình của bạn</Typography>
            <Stack direction="row" spacing={1}>
              <Button variant={category === 'WORK' ? 'contained' : 'outlined'} size="sm" onClick={() => setCategory('WORK')}>
                Công việc
              </Button>
              <Button variant={category === 'PERSONAL' ? 'contained' : 'outlined'} size="sm" onClick={() => setCategory('PERSONAL')}>
                Cá nhân
              </Button>
            </Stack>
          </Stack>
          {!customizing && (
            <Button variant="outlined" size="sm" onClick={() => setCustomizing(true)}>
              Tùy chỉnh lộ trình
            </Button>
          )}
        </Stack>

        {roadmapsError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRoadmapsError(null)}>
            {roadmapsError}
          </Alert>
        )}

        {customizing ? (
          <RoadmapCustomizePanel
            category={category}
            durationWeeks={customizeSource?.durationWeeks ?? null}
            hoursPerWeek={customizeSource?.hoursPerWeek ?? null}
            milestones={customizeSource?.milestones ?? []}
            settings={defaultSettings}
            onCancel={() => setCustomizing(false)}
            onSave={handleSaveCustomize}
            saving={savingSettings}
          />
        ) : !hasAnyRoadmap ? (
          <Typography variant="body2" sx={{ color: colorTokens.secondary, textAlign: 'center', py: 3 }}>
            Chưa có lộ trình. Dùng trợ lý AI bên dưới để tạo đề xuất đầu tiên.
          </Typography>
        ) : (
          <Stack spacing={3}>
            <Stack direction="row" spacing={1}>
              <Button variant={viewMode === 'stair' ? 'contained' : 'outlined'} size="sm" onClick={() => setViewMode('stair')}>
                Bậc thang
              </Button>
              <Button variant={viewMode === 'diagram' ? 'contained' : 'outlined'} size="sm" onClick={() => setViewMode('diagram')}>
                Sơ đồ
              </Button>
            </Stack>

            {isDraft && draftRoadmap && (
              <Box>
                <RoadmapSection
                  roadmap={draftRoadmap}
                  defaultExpanded
                  viewMode={viewMode}
                  character={character}
                  isDraft
                  onSetViewMode={setViewMode}
                  onToggleTask={(taskId, done) => handleToggleTask('draft', taskId, done)}
                />
                <Stack direction="row" spacing={1.5} sx={{ mt: 2 }}>
                  <Button variant="contained" onClick={() => void handleSaveAiProposal()}>
                    Lưu lộ trình
                  </Button>
                  <Button variant="outlined" onClick={() => setAiProposal(null)}>
                    Hủy đề xuất
                  </Button>
                </Stack>
              </Box>
            )}

            {savedRoadmaps.map((roadmap, i) => (
              <RoadmapSection
                key={roadmap.id}
                roadmap={roadmap}
                defaultExpanded={!isDraft && i === 0}
                viewMode={viewMode}
                character={character}
                onSetViewMode={setViewMode}
                onToggleTask={(taskId, done) => handleToggleTask(roadmap.id, taskId, done)}
              />
            ))}
          </Stack>
        )}
      </Card>

      <Card title="Dựng lộ trình bằng AI" sx={{ mb: 3, minWidth: 0 }}>
        <Typography variant="body2" sx={{ mb: 1.5, color: colorTokens.secondary }}>
          Nhập mong muốn của bạn cho mục tiêu {category === 'WORK' ? 'Công việc' : 'Cá nhân'} đang chọn. AI sẽ đề xuất
          lộ trình với cột mốc và nhiệm vụ đo lường được — bạn xem, chỉnh sửa rồi mới lưu. Mỗi lần lưu sẽ tạo một lộ
          trình mới, không ghi đè lộ trình đã lưu trước đó.
        </Typography>

        <Box component="form" onSubmit={(e) => { e.preventDefault(); void handleAskAI(); }}>
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={10}
            placeholder="Ví dụ: Tôi muốn trở thành Product Manager trong 6 tháng tới. Tôi hiện là Frontend Developer..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            disabled={aiBusy}
            sx={{ mb: 1 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" disabled={aiBusy || !aiInput.trim()}>
              {aiBusy ? 'Đang tạo…' : 'Gửi'}
            </Button>
          </Box>
        </Box>

        {aiError && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setAiError(null)}>
            {aiError}
          </Alert>
        )}
      </Card>
    </Box>
  );
}
